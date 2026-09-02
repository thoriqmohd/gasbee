-- Guest (anon) read access for public catalog browsing
GRANT SELECT ON public.categories TO anon;
GRANT SELECT ON public.banners TO anon;
GRANT SELECT ON public.products TO anon;
GRANT SELECT ON public.merchants TO anon;
GRANT SELECT ON public.merchants_public TO anon;
GRANT SELECT ON public.riders_public TO anon;

ALTER POLICY "read categories" ON public.categories TO anon, authenticated;
ALTER POLICY "read active banners" ON public.banners TO anon, authenticated;
ALTER POLICY "read active or own products" ON public.products TO anon, authenticated;

GRANT EXECUTE ON FUNCTION public.get_public_fee_settings() TO anon;
GRANT EXECUTE ON FUNCTION public.validate_promotion(text) TO anon;
