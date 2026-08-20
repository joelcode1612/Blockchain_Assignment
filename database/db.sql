-- WARNING: This schema is for context only and is not meant to be run.
-- Table order and constraints may not be valid for execution.

CREATE TABLE public.users (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  wallet_address character varying NOT NULL UNIQUE,
  role text NOT NULL CHECK (role = ANY (ARRAY['Shipper'::text, 'Carrier'::text])),
  display_name text NOT NULL,
  email text,
  reputation_balance integer DEFAULT 0,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT users_pkey PRIMARY KEY (id)
);
CREATE TABLE public.agreements (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  onchain_id integer UNIQUE,
  agreement_name character varying,
  shipper_wallet character varying NOT NULL,
  carrier_wallet character varying NOT NULL,
  escrow_amount numeric NOT NULL,
  released_amount numeric DEFAULT 0,
  cargo_type character varying,
  weight_kg numeric,
  handling_instructions text,
  deadline timestamp with time zone NOT NULL,
  status character varying DEFAULT 'PendingAcceptance'::character varying CHECK (status::text = ANY (ARRAY['PendingAcceptance'::character varying, 'AwaitingFunding'::character varying, 'Active'::character varying, 'Completed'::character varying, 'Rejected'::character varying, 'Cancelled'::character varying, 'Refunded'::character varying, 'Expired'::character varying]::text[])),
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT agreements_pkey PRIMARY KEY (id),
  CONSTRAINT agreements_shipper_fkey FOREIGN KEY (shipper_wallet) REFERENCES public.users(wallet_address),
  CONSTRAINT agreements_carrier_fkey FOREIGN KEY (carrier_wallet) REFERENCES public.users(wallet_address)
);
CREATE TABLE public.milestones (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  agreement_onchain_id integer NOT NULL,
  milestone_index integer NOT NULL,
  description text NOT NULL,
  payment_percentage integer NOT NULL,
  status character varying DEFAULT 'Pending'::character varying CHECK (status::text = ANY (ARRAY['Pending'::character varying, 'Submitted'::character varying, 'Verified'::character varying, 'Paid'::character varying]::text[])),
  submitted_at timestamp with time zone,
  verified_at timestamp with time zone,
  paid_at timestamp with time zone,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT milestones_pkey PRIMARY KEY (id),
  CONSTRAINT milestones_agreement_fkey FOREIGN KEY (agreement_onchain_id) REFERENCES public.agreements(onchain_id)
);
CREATE TABLE public.escrow_history (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  agreement_onchain_id integer NOT NULL,
  shipper_wallet character varying NOT NULL,
  amount numeric NOT NULL,
  transaction_hash text NOT NULL UNIQUE,
  funded_at timestamp with time zone DEFAULT now(),
  CONSTRAINT escrow_history_pkey PRIMARY KEY (id),
  CONSTRAINT escrow_history_agreement_fkey FOREIGN KEY (agreement_onchain_id) REFERENCES public.agreements(onchain_id)
);
CREATE TABLE public.payment_history (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  agreement_onchain_id integer NOT NULL,
  milestone_index integer NOT NULL,
  receiver_wallet character varying NOT NULL,
  amount numeric NOT NULL,
  transaction_hash text NOT NULL UNIQUE,
  paid_at timestamp with time zone DEFAULT now(),
  CONSTRAINT payment_history_pkey PRIMARY KEY (id),
  CONSTRAINT payment_history_agreement_fkey FOREIGN KEY (agreement_onchain_id) REFERENCES public.agreements(onchain_id)
);
CREATE TABLE public.refund_history (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  agreement_onchain_id integer NOT NULL,
  shipper_wallet character varying NOT NULL,
  amount numeric NOT NULL,
  transaction_hash text NOT NULL UNIQUE,
  refunded_at timestamp with time zone DEFAULT now(),
  CONSTRAINT refund_history_pkey PRIMARY KEY (id),
  CONSTRAINT refund_history_agreement_fkey FOREIGN KEY (agreement_onchain_id) REFERENCES public.agreements(onchain_id)
);
CREATE TABLE public.reputation_history (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  agreement_onchain_id integer NOT NULL,
  carrier_wallet character varying NOT NULL,
  amount integer NOT NULL,
  transaction_hash text NOT NULL UNIQUE,
  rewarded_at timestamp with time zone DEFAULT now(),
  CONSTRAINT reputation_history_pkey PRIMARY KEY (id),
  CONSTRAINT reputation_history_agreement_fkey FOREIGN KEY (agreement_onchain_id) REFERENCES public.agreements(onchain_id)
);