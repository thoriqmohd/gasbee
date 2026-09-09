UPDATE public.merchants
SET name = 'R Gas Enterprise'
WHERE name IN ('TEST - Rizq S Enterprise', 'Rizq S Enterprise')
   OR slug = 'rizq-s-enterprise';

SELECT id, name, slug FROM public.merchants WHERE slug = 'rizq-s-enterprise';