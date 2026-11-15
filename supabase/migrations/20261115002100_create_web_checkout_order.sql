BEGIN;
SET LOCAL lock_timeout = '5s';

CREATE OR REPLACE FUNCTION public.create_web_checkout_order(
  p_order_id uuid,
  p_address_id uuid,
  p_items jsonb,
  p_delivery_type text,
  p_scheduled_at timestamptz,
  p_gas_exchange_type text,
  p_notes text,
  p_promotion_code text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $function$
DECLARE
  customer uuid := auth.uid();
  requested_items jsonb;
  ordered_items jsonb;
  product_lines jsonb;
  current_order public.orders%ROWTYPE;
  merchant uuid;
  item_count integer;
  cylinder_qty bigint;
  refill_qty bigint;
  has_industrial boolean;
  subtotal numeric;
  discount_amount numeric := 0;
  promo record;
  promo_code text := NULLIF(pg_catalog.upper(pg_catalog.btrim(p_promotion_code)), '');
  notes_text text;
  delivery_kind public.delivery_type;
  delivery_at timestamptz;
  gas_kind text := NULLIF(pg_catalog.btrim(p_gas_exchange_type), '');
  address_position record;
  merchant_position record;
  distance_km double precision;
  sale_uses_assisted_guard boolean;
  needs_delivery_quote boolean := false;
  delivery_amount numeric := 0;
  address_payload jsonb;
BEGIN
  IF customer IS NULL THEN
    RAISE EXCEPTION 'Log masuk untuk meneruskan checkout.' USING ERRCODE = '42501';
  END IF;

  IF p_order_id IS NULL OR p_address_id IS NULL
     OR p_delivery_type IS NULL OR p_delivery_type NOT IN ('immediate', 'scheduled')
     OR (p_delivery_type = 'scheduled' AND p_scheduled_at IS NULL)
     OR (gas_kind IS NOT NULL AND gas_kind NOT IN ('petronas', 'non_petronas'))
     OR pg_catalog.length(COALESCE(p_notes, '')) > 500
     OR pg_catalog.length(COALESCE(promo_code, '')) > 100 THEN
    RAISE EXCEPTION 'Butiran checkout tidak sah.' USING ERRCODE = '22023';
  END IF;

  IF pg_catalog.jsonb_typeof(p_items) IS DISTINCT FROM 'array' THEN
    RAISE EXCEPTION 'Troli anda tidak sah.' USING ERRCODE = '22023';
  END IF;
  IF pg_catalog.jsonb_array_length(p_items) NOT BETWEEN 1 AND 100 THEN
    RAISE EXCEPTION 'Troli anda kosong atau mengandungi terlalu banyak produk.' USING ERRCODE = '22023';
  END IF;
  IF EXISTS (
    SELECT 1 FROM pg_catalog.jsonb_array_elements(p_items) AS i(item)
    WHERE pg_catalog.jsonb_typeof(i.item) IS DISTINCT FROM 'object'
       OR pg_catalog.jsonb_typeof(i.item -> 'product_id') IS DISTINCT FROM 'string'
       OR (i.item ->> 'product_id') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
       OR pg_catalog.jsonb_typeof(i.item -> 'quantity') IS DISTINCT FROM 'number'
       OR (i.item ->> 'quantity') !~ '^(100|[1-9][0-9]?)$'
       OR COALESCE(i.item ->> 'type', '') NOT IN ('refill', 'new_cylinder', 'deposit')
  ) THEN
    RAISE EXCEPTION 'Produk atau kuantiti dalam troli tidak sah.' USING ERRCODE = '22023';
  END IF;

  SELECT pg_catalog.jsonb_agg(
    pg_catalog.jsonb_build_object('product_id', i.product_id, 'quantity', i.quantity, 'type', i.type)
    ORDER BY i.product_id, i.type
  ), pg_catalog.count(DISTINCT i.product_id)::integer
  INTO requested_items, item_count
  FROM pg_catalog.jsonb_to_recordset(p_items) AS i(product_id uuid, quantity integer, type text);

  IF item_count <> pg_catalog.jsonb_array_length(p_items) THEN
    RAISE EXCEPTION 'Gabungkan kuantiti produk yang sama sebelum meneruskan.' USING ERRCODE = '22023';
  END IF;

  delivery_kind := p_delivery_type::public.delivery_type;
  delivery_at := CASE WHEN delivery_kind = 'scheduled' THEN p_scheduled_at ELSE NULL END;
  notes_text := pg_catalog.concat_ws(' · ', NULLIF(pg_catalog.btrim(p_notes), ''), 'Order via website');

  -- The same attempt can be sent again after a lost response, including from a
  -- second tab. A committed order must match the original request.
  PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_order_id::text, 0));
  SELECT o.* INTO current_order FROM public.orders o
  WHERE o.id = p_order_id AND o.customer_id = customer;
  IF FOUND THEN
    SELECT pg_catalog.jsonb_agg(
      pg_catalog.jsonb_build_object('product_id', i.product_id, 'quantity', i.quantity, 'type', i.type)
      ORDER BY i.product_id, i.type
    )
    INTO ordered_items FROM public.order_items i WHERE i.order_id = current_order.id;

    IF current_order.payment_method IS DISTINCT FROM 'fpx'::public.payment_method
       OR current_order.address_snapshot ->> 'id' IS DISTINCT FROM p_address_id::text
       OR current_order.delivery_type IS DISTINCT FROM delivery_kind
       OR current_order.scheduled_at IS DISTINCT FROM delivery_at
       OR current_order.gas_exchange_type IS DISTINCT FROM gas_kind
       OR current_order.notes IS DISTINCT FROM notes_text
       OR current_order.promotion_code IS DISTINCT FROM promo_code
       OR ordered_items IS DISTINCT FROM requested_items THEN
      RAISE EXCEPTION 'Percubaan checkout ini sudah digunakan. Semak pesanan atau gunakan percubaan baharu.'
        USING ERRCODE = '22023';
    END IF;
  ELSE
    IF delivery_at IS NOT NULL AND (NOT pg_catalog.isfinite(delivery_at) OR delivery_at <= pg_catalog.now()) THEN
      RAISE EXCEPTION 'Pilih tarikh dan masa penghantaran akan datang.' USING ERRCODE = '22023';
    END IF;

    -- Get the customer's saved address. The production order insert trigger
    -- checks its current coordinates, merchant radius, and calculates the fee.
    SELECT a.* INTO address_position FROM public.addresses a
    WHERE a.id = p_address_id AND a.user_id = customer;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Pilih alamat penghantaran yang sah.' USING ERRCODE = '22023';
    END IF;

    WITH lines AS (
      SELECT p.id, p.merchant_id, p.name, p.image_url, p.cylinder_size_kg, c.slug,
             i.quantity, i.type, p.refill_price, p.selling_price, p.deposit_amount,
             COALESCE(NULLIF(p.new_cylinder_price, 0), p.selling_price, 0) AS new_price,
             CASE
               WHEN c.slug = 'lpg-refill' THEN 'refill'
               WHEN c.slug = 'accessories' OR COALESCE(NULLIF(p.new_cylinder_price, 0), p.selling_price, 0) > 0 THEN 'new_cylinder'
               WHEN p.refill_price > 0 THEN 'refill'
               ELSE 'deposit'
             END AS expected_type
      FROM pg_catalog.jsonb_to_recordset(requested_items) AS i(product_id uuid, quantity integer, type text)
      JOIN public.products p ON p.id = i.product_id
      JOIN public.categories c ON c.id = p.category_id
      JOIN public.merchants m ON m.id = p.merchant_id
      WHERE p.is_active AND NOT p.is_coming_soon AND c.is_active AND m.status = 'active'
        AND c.slug IN ('lpg-refill', 'cylinder', 'accessories', 'industrial-gas')
    ),
    valid_lines AS (
      SELECT *, CASE
        WHEN slug = 'accessories' THEN selling_price
        WHEN expected_type = 'refill' THEN refill_price
        WHEN expected_type = 'new_cylinder' THEN new_price + refill_price
        ELSE deposit_amount
      END AS unit_price
      FROM lines WHERE type = expected_type
    )
    SELECT pg_catalog.jsonb_agg(
      pg_catalog.jsonb_build_object(
        'product_id', id, 'quantity', quantity, 'type', type,
        'name', pg_catalog.concat_ws(', ',
          CASE slug WHEN 'lpg-refill' THEN 'LPG Refill' WHEN 'cylinder' THEN 'New Cylinder Gas'
            WHEN 'industrial-gas' THEN 'Industrial Gas' ELSE 'Accessories' END, name),
        'image_url', image_url, 'cylinder_size_kg', cylinder_size_kg, 'unit_price', unit_price
      ) ORDER BY id
    ),
    CASE WHEN pg_catalog.count(DISTINCT merchant_id) = 1 THEN pg_catalog.min(merchant_id::text)::uuid END,
    pg_catalog.count(*)::integer,
    pg_catalog.sum(quantity) FILTER (WHERE slug IN ('cylinder', 'lpg-refill')),
    pg_catalog.sum(quantity) FILTER (WHERE slug = 'lpg-refill' OR (type = 'refill' AND slug = 'cylinder')),
    pg_catalog.bool_or(slug = 'industrial-gas'),
    pg_catalog.sum(unit_price * quantity)
    INTO product_lines, merchant, item_count, cylinder_qty, refill_qty, has_industrial, subtotal
    FROM valid_lines WHERE unit_price > 0;

    IF item_count <> pg_catalog.jsonb_array_length(requested_items) THEN
      RAISE EXCEPTION 'Produk dalam troli telah berubah atau tidak tersedia. Sila semak troli.' USING ERRCODE = '22023';
    END IF;
    IF merchant IS NULL THEN
      RAISE EXCEPTION 'Satu pesanan hanya boleh mengandungi produk daripada satu peniaga.' USING ERRCODE = '22023';
    END IF;
    IF cylinder_qty > 2 THEN
      RAISE EXCEPTION 'Maksimum 2 tong gas setiap transaksi.' USING ERRCODE = '22023';
    END IF;
    IF refill_qty > 0 AND gas_kind IS NULL THEN
      RAISE EXCEPTION 'Pilih jenis tong gas semasa.' USING ERRCODE = '22023';
    END IF;
    IF COALESCE(refill_qty, 0) = 0 AND gas_kind IS NOT NULL THEN
      RAISE EXCEPTION 'Jenis tong gas semasa hanya diperlukan untuk isian semula.' USING ERRCODE = '22023';
    END IF;
    IF has_industrial AND (
      SELECT v.status::text FROM public.company_verifications v
      WHERE v.user_id = customer ORDER BY v.created_at DESC LIMIT 1
    ) IS DISTINCT FROM 'approved' THEN
      RAISE EXCEPTION 'Akaun syarikat diperlukan untuk gas industri.' USING ERRCODE = '42501';
    END IF;

    -- The shared trigger leaves administrative/merchant-assisted orders alone.
    -- Price even those authenticated website purchases from server-owned data.
    sale_uses_assisted_guard := COALESCE(public.is_admin(customer) OR merchant = public.user_merchant_id(customer), false);
    address_payload := pg_catalog.jsonb_build_object('id', p_address_id);
    IF promo_code IS NOT NULL THEN
      SELECT * INTO promo FROM public.validate_promotion(promo_code) LIMIT 1;
      IF NOT FOUND
        OR (promo.applies_to = 'merchant' AND promo.merchant_id IS DISTINCT FROM merchant)
        OR (promo.min_order_amount IS NOT NULL AND subtotal < promo.min_order_amount) THEN
        RAISE EXCEPTION 'Kod promo tidak sah untuk pesanan ini.' USING ERRCODE = '22023';
      END IF;
      needs_delivery_quote := promo.type = 'free_delivery';
    END IF;

    IF sale_uses_assisted_guard OR needs_delivery_quote THEN
      SELECT m.latitude, m.longitude, COALESCE(m.delivery_radius_km, 10) AS radius
      INTO STRICT merchant_position FROM public.merchants m WHERE m.id = merchant;
      IF address_position.property_type IS NULL
         OR NOT COALESCE(address_position.latitude BETWEEN -90 AND 90 AND address_position.longitude BETWEEN -180 AND 180, false)
         OR (address_position.latitude = 0 AND address_position.longitude = 0) THEN
        RAISE EXCEPTION 'Kemas kini jenis kediaman dan lokasi pada alamat penghantaran.' USING ERRCODE = '22023';
      END IF;
      IF NOT COALESCE(merchant_position.latitude BETWEEN -90 AND 90 AND merchant_position.longitude BETWEEN -180 AND 180, false)
         OR (merchant_position.latitude = 0 AND merchant_position.longitude = 0)
         OR merchant_position.radius <= 0 THEN
        RAISE EXCEPTION 'Penghantaran daripada peniaga ini tidak tersedia.' USING ERRCODE = '22023';
      END IF;
      distance_km := 6371.0 * 2 * pg_catalog.asin(
        pg_catalog.sqrt(LEAST(1.0, GREATEST(0.0,
          pg_catalog.power(pg_catalog.sin(pg_catalog.radians((address_position.latitude - merchant_position.latitude)::double precision) / 2), 2)
          + pg_catalog.cos(pg_catalog.radians(address_position.latitude::double precision))
            * pg_catalog.cos(pg_catalog.radians(merchant_position.latitude::double precision))
            * pg_catalog.power(pg_catalog.sin(pg_catalog.radians((address_position.longitude - merchant_position.longitude)::double precision) / 2), 2)
        )))
      );
      IF distance_km > merchant_position.radius THEN
        RAISE EXCEPTION 'Alamat anda di luar kawasan penghantaran peniaga ini.' USING ERRCODE = '22023';
      END IF;
      delivery_amount := pg_catalog.round(
        LEAST(GREATEST(public.setting_numeric('delivery_base_fee', 5), 0)
          + GREATEST(distance_km::numeric - GREATEST(public.setting_numeric('delivery_base_km', 5), 0), 0)
            * GREATEST(public.setting_numeric('delivery_per_km', 1), 0), 500)
        + CASE WHEN address_position.property_type = 'highrise'
          THEN public.setting_numeric('highrise_delivery_surcharge', 3) ELSE 0 END, 2);
    END IF;

    IF sale_uses_assisted_guard THEN
      address_payload := pg_catalog.jsonb_build_object(
        'id', p_address_id, 'label', address_position.label,
        'recipient_name', address_position.recipient_name, 'recipient_phone', address_position.recipient_phone,
        'address_line1', address_position.address_line1, 'address_line2', address_position.address_line2,
        'city', address_position.city, 'state', address_position.state, 'postcode', address_position.postcode,
        'latitude', address_position.latitude, 'longitude', address_position.longitude,
        'property_type', address_position.property_type, 'floor', address_position.floor, 'unit_no', address_position.unit_no
      );
    END IF;

    IF promo_code IS NOT NULL THEN
      IF promo.type = 'percent' THEN
        discount_amount := LEAST(subtotal * promo.value / 100, COALESCE(promo.max_discount, subtotal), subtotal);
      ELSIF promo.type = 'flat' THEN
        discount_amount := LEAST(promo.value, COALESCE(promo.max_discount, subtotal), subtotal);
      ELSIF promo.type = 'free_delivery' THEN
        discount_amount := LEAST(delivery_amount, COALESCE(promo.max_discount, delivery_amount));
      ELSE
        RAISE EXCEPTION 'Kod promo ini tidak disokong.' USING ERRCODE = '22023';
      END IF;
      discount_amount := pg_catalog.round(GREATEST(COALESCE(discount_amount, 0), 0), 2);
    END IF;

    INSERT INTO public.orders (
      id, customer_id, merchant_id, address_snapshot, payment_method, payment_status, status,
      delivery_type, scheduled_at, gas_exchange_type, notes, promotion_code, discount,
      delivery_fee, service_fee, processing_fee
    )
    VALUES (
      p_order_id, customer, merchant, address_payload,
      'fpx', 'pending', 'pending', delivery_kind, delivery_at, gas_kind, notes_text, promo_code, discount_amount,
      delivery_amount, public.setting_numeric('service_fee', 5), public.setting_numeric('processing_fee', 0)
    );

    INSERT INTO public.order_items (
      order_id, product_id, product_name, product_image_url, cylinder_size_kg, type, quantity, unit_price, subtotal
    )
    SELECT p_order_id, i.product_id, i.name, i.image_url, i.cylinder_size_kg,
           i.type::public.order_item_type, i.quantity, i.unit_price, i.quantity * i.unit_price
    FROM pg_catalog.jsonb_to_recordset(product_lines)
      AS i(product_id uuid, name text, image_url text, cylinder_size_kg numeric, type text, quantity integer, unit_price numeric);

    SELECT o.* INTO STRICT current_order FROM public.orders o
    WHERE o.id = p_order_id AND o.customer_id = customer;

    IF current_order.discount IS DISTINCT FROM discount_amount THEN
      RAISE EXCEPTION 'Diskaun telah berubah. Semak semula kod promo sebelum membuat pesanan.' USING ERRCODE = '22023';
    END IF;
    IF current_order.total_amount IS NULL OR current_order.total_amount <= 0
       OR current_order.items_subtotal IS DISTINCT FROM subtotal THEN
      RAISE EXCEPTION 'Jumlah pesanan tidak sah atau harga telah berubah. Sila semak troli.' USING ERRCODE = '22023';
    END IF;
  END IF;

  RETURN pg_catalog.jsonb_build_object(
    'id', current_order.id, 'code', current_order.code,
    'status', current_order.status, 'payment_status', current_order.payment_status,
    'payment_method', current_order.payment_method,
    'total_amount', current_order.total_amount, 'items_subtotal', current_order.items_subtotal,
    'delivery_fee', current_order.delivery_fee, 'service_fee', current_order.service_fee,
    'processing_fee', current_order.processing_fee, 'discount', current_order.discount,
    'gas_exchange_fee', current_order.gas_exchange_fee
  );
END
$function$;

REVOKE EXECUTE ON FUNCTION public.create_web_checkout_order(uuid, uuid, jsonb, text, timestamptz, text, text, text)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_web_checkout_order(uuid, uuid, jsonb, text, timestamptz, text, text, text)
  TO authenticated;

COMMIT;
