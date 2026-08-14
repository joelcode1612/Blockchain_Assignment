-- =========================================================
-- USERS: ADD UPDATED_AT
-- =========================================================

ALTER TABLE public.users
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ
DEFAULT NOW();

-- =========================================================
-- UPDATED_AT FUNCTION
-- =========================================================

CREATE OR REPLACE FUNCTION public.update_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS users_updated_at
ON public.users;

CREATE TRIGGER users_updated_at
BEFORE UPDATE ON public.users
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at();


-- =========================================================
-- AGREEMENTS: ADD MISSING APPLICATION FIELDS
-- =========================================================

ALTER TABLE public.agreements
ADD COLUMN IF NOT EXISTS title TEXT;

ALTER TABLE public.agreements
ADD COLUMN IF NOT EXISTS description TEXT;

ALTER TABLE public.agreements
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ
DEFAULT NOW();

-- =========================================================
-- MILESTONES: ADD TIMESTAMP FIELDS
-- =========================================================

ALTER TABLE public.milestones
ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ
DEFAULT NOW();

ALTER TABLE public.milestones
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ
DEFAULT NOW();

-- =========================================================
-- ESCROWS: ADD UPDATED_AT
-- =========================================================

ALTER TABLE public.escrows
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ
DEFAULT NOW();

-- =========================================================
-- PAYMENTS: ADD CREATED_AT
-- =========================================================

ALTER TABLE public.payments
ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ
DEFAULT NOW();

-- =========================================================
-- UPDATED_AT TRIGGERS
-- =========================================================

DROP TRIGGER IF EXISTS agreements_updated_at
ON public.agreements;

CREATE TRIGGER agreements_updated_at
BEFORE UPDATE ON public.agreements
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at();


DROP TRIGGER IF EXISTS milestones_updated_at
ON public.milestones;

CREATE TRIGGER milestones_updated_at
BEFORE UPDATE ON public.milestones
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at();


DROP TRIGGER IF EXISTS escrows_updated_at
ON public.escrows;

CREATE TRIGGER escrows_updated_at
BEFORE UPDATE ON public.escrows
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at();