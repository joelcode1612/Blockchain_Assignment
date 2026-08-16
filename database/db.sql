-- ========================================================================
-- 1. USERS TABLE (User & Reputation Module)
-- Ref: FR-001, FR-002, FR-003, FR-031
-- ========================================================================
CREATE TABLE public.users (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    wallet_address text NOT NULL UNIQUE,
    role text NOT NULL CHECK (role IN ('Shipper', 'Carrier')),
    display_name text NOT NULL,
    email text, 
    reputation_balance integer DEFAULT 0, -- ADDED: Satisfies FR-031 (Reputation token balance)
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    
    CONSTRAINT users_pkey PRIMARY KEY (id)
);

-- ========================================================================
-- 2. AGREEMENTS TABLE (Agreement & Refund Module)
-- Ref: FR-005 to FR-012, FR-028
-- ========================================================================
CREATE TABLE public.agreements (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    onchain_id integer UNIQUE, -- The agreementCounter from Solidity
    shipper_wallet text NOT NULL,
    carrier_wallet text NOT NULL,
    escrow_amount text NOT NULL, -- Stored as text to handle massive Wei numbers
    released_amount text DEFAULT '0',
    deadline timestamp with time zone NOT NULL,
    status text DEFAULT 'PendingAcceptance' CHECK (status IN (
        'PendingAcceptance', 'AwaitingFunding', 'Active', 
        'Completed', 'Rejected', 'Cancelled', 'Refunded', 'Expired'
    )),
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    
    CONSTRAINT agreements_pkey PRIMARY KEY (id),
    CONSTRAINT agreements_shipper_fkey FOREIGN KEY (shipper_wallet) REFERENCES public.users(wallet_address),
    CONSTRAINT agreements_carrier_fkey FOREIGN KEY (carrier_wallet) REFERENCES public.users(wallet_address)
);

-- ========================================================================
-- 3. MILESTONES TABLE (Milestone Module)
-- Ref: FR-017, FR-018, FR-035
-- ========================================================================
CREATE TABLE public.milestones (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    agreement_onchain_id integer NOT NULL, 
    milestone_index integer NOT NULL, 
    description text NOT NULL, 
    payment_percentage integer NOT NULL,
    status text DEFAULT 'Pending' CHECK (status IN ('Pending', 'Submitted', 'Verified', 'Paid')),
    submitted_at timestamp with time zone,
    verified_at timestamp with time zone,
    paid_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now(),
    
    CONSTRAINT milestones_pkey PRIMARY KEY (id),
    CONSTRAINT milestones_agreement_fkey FOREIGN KEY (agreement_onchain_id) REFERENCES public.agreements(onchain_id),
    CONSTRAINT unique_milestone_index UNIQUE (agreement_onchain_id, milestone_index)
);

-- ========================================================================
-- 4. ESCROW FUNDING HISTORY (Transaction History Module)
-- ADDED: Satisfies FR-034 (Display escrow funding history)
-- ========================================================================
CREATE TABLE public.escrow_history (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    agreement_onchain_id integer NOT NULL,
    shipper_wallet text NOT NULL,
    amount text NOT NULL, -- Stored as text for Wei
    transaction_hash text NOT NULL UNIQUE, -- Blockchain tx receipt
    funded_at timestamp with time zone DEFAULT now(),
    
    CONSTRAINT escrow_history_pkey PRIMARY KEY (id),
    CONSTRAINT escrow_history_agreement_fkey FOREIGN KEY (agreement_onchain_id) REFERENCES public.agreements(onchain_id)
);

-- ========================================================================
-- 5. PAYMENT HISTORY TABLE (Transaction History Module)
-- Ref: FR-036 (Display payment release history)
-- ========================================================================
CREATE TABLE public.payment_history (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    agreement_onchain_id integer NOT NULL,
    milestone_index integer NOT NULL,
    receiver_wallet text NOT NULL,
    amount text NOT NULL, 
    transaction_hash text NOT NULL UNIQUE, 
    paid_at timestamp with time zone DEFAULT now(),
    
    CONSTRAINT payment_history_pkey PRIMARY KEY (id),
    CONSTRAINT payment_history_agreement_fkey FOREIGN KEY (agreement_onchain_id) REFERENCES public.agreements(onchain_id)
);

-- ========================================================================
-- 6. REFUND HISTORY TABLE (Transaction History Module)
-- ADDED: Satisfies FR-037 (Display refund history)
-- ========================================================================
CREATE TABLE public.refund_history (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    agreement_onchain_id integer NOT NULL,
    shipper_wallet text NOT NULL,
    amount text NOT NULL, 
    transaction_hash text NOT NULL UNIQUE, 
    refunded_at timestamp with time zone DEFAULT now(),
    
    CONSTRAINT refund_history_pkey PRIMARY KEY (id),
    CONSTRAINT refund_history_agreement_fkey FOREIGN KEY (agreement_onchain_id) REFERENCES public.agreements(onchain_id)
);

-- ========================================================================
-- 7. REPUTATION HISTORY TABLE (Reputation & Transaction Module)
-- ADDED: Satisfies FR-038 (Display reputation token reward history)
-- ========================================================================
CREATE TABLE public.reputation_history (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    agreement_onchain_id integer NOT NULL,
    carrier_wallet text NOT NULL,
    amount integer NOT NULL, -- Tokens are usually whole numbers
    transaction_hash text NOT NULL UNIQUE, 
    rewarded_at timestamp with time zone DEFAULT now(),
    
    CONSTRAINT reputation_history_pkey PRIMARY KEY (id),
    CONSTRAINT reputation_history_agreement_fkey FOREIGN KEY (agreement_onchain_id) REFERENCES public.agreements(onchain_id)
);