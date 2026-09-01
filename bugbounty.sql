--
-- PostgreSQL database dump
--

\restrict Ak0e89kP2UAehfI2qcWQNQirrKalFvKu2RZCT9pHADoOdGkkjPvaRxOYube9CfP

-- Dumped from database version 17.4
-- Dumped by pg_dump version 18.1

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: authorization_issuances; Type: TABLE; Schema: public; Owner: jumana_bountyapp
--

CREATE TABLE public.authorization_issuances (
    id bigint NOT NULL,
    wallet_address character varying(42) NOT NULL,
    participant_type smallint NOT NULL,
    organization_id character(66) NOT NULL,
    action smallint NOT NULL,
    action_hash character(66) NOT NULL,
    nonce numeric(78,0) NOT NULL,
    deadline timestamp with time zone NOT NULL,
    chain_id bigint NOT NULL,
    verifying_contract character varying(42) NOT NULL,
    verifier_address character varying(42) NOT NULL,
    authorization_digest character(66) NOT NULL,
    signature text NOT NULL,
    status character varying(20) DEFAULT 'issued'::character varying NOT NULL,
    used_transaction_hash character(66),
    issued_at timestamp with time zone DEFAULT now() NOT NULL,
    used_at timestamp with time zone,
    CONSTRAINT authorization_issuances_action_check CHECK (((action >= 1) AND (action <= 6))),
    CONSTRAINT authorization_issuances_participant_type_check CHECK ((participant_type = ANY (ARRAY[1, 2]))),
    CONSTRAINT authorization_issuances_status_check CHECK (((status)::text = ANY ((ARRAY['issued'::character varying, 'used'::character varying, 'expired'::character varying, 'revoked'::character varying])::text[])))
);


ALTER TABLE public.authorization_issuances OWNER TO jumana_bountyapp;

--
-- Name: authorization_issuances_id_seq; Type: SEQUENCE; Schema: public; Owner: jumana_bountyapp
--

CREATE SEQUENCE public.authorization_issuances_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.authorization_issuances_id_seq OWNER TO jumana_bountyapp;

--
-- Name: authorization_issuances_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: jumana_bountyapp
--

ALTER SEQUENCE public.authorization_issuances_id_seq OWNED BY public.authorization_issuances.id;


--
-- Name: blockchain_events; Type: TABLE; Schema: public; Owner: jumana_bountyapp
--

CREATE TABLE public.blockchain_events (
    id bigint NOT NULL,
    chain_id bigint NOT NULL,
    contract_address character varying(42) NOT NULL,
    event_name character varying(100) NOT NULL,
    transaction_hash character(66) NOT NULL,
    log_index integer NOT NULL,
    block_number bigint NOT NULL,
    block_hash character(66) NOT NULL,
    event_data jsonb NOT NULL,
    processed_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.blockchain_events OWNER TO jumana_bountyapp;

--
-- Name: blockchain_events_id_seq; Type: SEQUENCE; Schema: public; Owner: jumana_bountyapp
--

CREATE SEQUENCE public.blockchain_events_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.blockchain_events_id_seq OWNER TO jumana_bountyapp;

--
-- Name: blockchain_events_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: jumana_bountyapp
--

ALTER SEQUENCE public.blockchain_events_id_seq OWNED BY public.blockchain_events.id;


--
-- Name: bounties; Type: TABLE; Schema: public; Owner: jumana_bountyapp
--

CREATE TABLE public.bounties (
    id bigint NOT NULL,
    chain_id bigint NOT NULL,
    escrow_address character varying(42) NOT NULL,
    bounty_id numeric(78,0) NOT NULL,
    company_address character varying(42) NOT NULL,
    metadata_hash character(66) NOT NULL,
    metadata_cid text NOT NULL,
    total_escrow_wei numeric(78,0) NOT NULL,
    available_escrow_wei numeric(78,0) NOT NULL,
    start_time timestamp with time zone NOT NULL,
    end_time timestamp with time zone NOT NULL,
    refund_available_at timestamp with time zone,
    status smallint NOT NULL,
    creation_tx_hash character(66) NOT NULL,
    block_number bigint NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    company_organization_id character(66)
);


ALTER TABLE public.bounties OWNER TO jumana_bountyapp;

--
-- Name: bounties_id_seq; Type: SEQUENCE; Schema: public; Owner: jumana_bountyapp
--

CREATE SEQUENCE public.bounties_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.bounties_id_seq OWNER TO jumana_bountyapp;

--
-- Name: bounties_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: jumana_bountyapp
--

ALTER SEQUENCE public.bounties_id_seq OWNED BY public.bounties.id;


--
-- Name: bounty_metadata; Type: TABLE; Schema: public; Owner: jumana_bountyapp
--

CREATE TABLE public.bounty_metadata (
    id integer NOT NULL,
    bounty_id bigint NOT NULL,
    title character varying(255) NOT NULL,
    description text NOT NULL,
    severity character varying(50),
    scope text,
    created_at timestamp without time zone DEFAULT now()
);


ALTER TABLE public.bounty_metadata OWNER TO jumana_bountyapp;

--
-- Name: bounty_metadata_id_seq; Type: SEQUENCE; Schema: public; Owner: jumana_bountyapp
--

CREATE SEQUENCE public.bounty_metadata_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.bounty_metadata_id_seq OWNER TO jumana_bountyapp;

--
-- Name: bounty_metadata_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: jumana_bountyapp
--

ALTER SEQUENCE public.bounty_metadata_id_seq OWNED BY public.bounty_metadata.id;


--
-- Name: company_registration_challenges; Type: TABLE; Schema: public; Owner: jumana_bountyapp
--

CREATE TABLE public.company_registration_challenges (
    id uuid NOT NULL,
    wallet_address character varying(42) NOT NULL,
    registration_payload_hash character(66) NOT NULL,
    challenge_message text NOT NULL,
    expires_at timestamp with time zone NOT NULL,
    used_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT company_registration_challenge_expiry_check CHECK ((expires_at > created_at))
);


ALTER TABLE public.company_registration_challenges OWNER TO jumana_bountyapp;

--
-- Name: login_challenges; Type: TABLE; Schema: public; Owner: jumana_bountyapp
--

CREATE TABLE public.login_challenges (
    id uuid NOT NULL,
    participant_id bigint NOT NULL,
    wallet_address character varying(42) NOT NULL,
    challenge_message text NOT NULL,
    expires_at timestamp with time zone NOT NULL,
    used_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT login_challenge_expiry_check CHECK ((expires_at > created_at))
);


ALTER TABLE public.login_challenges OWNER TO jumana_bountyapp;

--
-- Name: participants; Type: TABLE; Schema: public; Owner: jumana_bountyapp
--

CREATE TABLE public.participants (
    id bigint NOT NULL,
    wallet_address character varying(42) NOT NULL,
    participant_type smallint NOT NULL,
    organization_id character(66),
    active boolean DEFAULT true NOT NULL,
    verified boolean DEFAULT false NOT NULL,
    validator_candidate boolean DEFAULT false NOT NULL,
    display_name character varying(150),
    email character varying(320),
    company_name character varying(200),
    profile_data jsonb DEFAULT '{}'::jsonb NOT NULL,
    verified_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    username character varying(80),
    CONSTRAINT participants_participant_type_check1 CHECK ((participant_type = ANY (ARRAY[1, 2])))
);


ALTER TABLE public.participants OWNER TO jumana_bountyapp;

--
-- Name: participants_onchain_legacy; Type: TABLE; Schema: public; Owner: jumana_bountyapp
--

CREATE TABLE public.participants_onchain_legacy (
    id bigint NOT NULL,
    chain_id bigint NOT NULL,
    registry_address character varying(42) NOT NULL,
    wallet_address character varying(42) NOT NULL,
    participant_type smallint NOT NULL,
    organization_id character(66) NOT NULL,
    active boolean DEFAULT true NOT NULL,
    validator_candidate boolean DEFAULT false NOT NULL,
    registered_at timestamp with time zone NOT NULL,
    registration_tx_hash character(66) NOT NULL,
    block_number bigint NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT participants_participant_type_check CHECK ((participant_type = ANY (ARRAY[1, 2])))
);


ALTER TABLE public.participants_onchain_legacy OWNER TO jumana_bountyapp;

--
-- Name: participants_id_seq; Type: SEQUENCE; Schema: public; Owner: jumana_bountyapp
--

CREATE SEQUENCE public.participants_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.participants_id_seq OWNER TO jumana_bountyapp;

--
-- Name: participants_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: jumana_bountyapp
--

ALTER SEQUENCE public.participants_id_seq OWNED BY public.participants_onchain_legacy.id;


--
-- Name: participants_id_seq1; Type: SEQUENCE; Schema: public; Owner: jumana_bountyapp
--

CREATE SEQUENCE public.participants_id_seq1
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.participants_id_seq1 OWNER TO jumana_bountyapp;

--
-- Name: participants_id_seq1; Type: SEQUENCE OWNED BY; Schema: public; Owner: jumana_bountyapp
--

ALTER SEQUENCE public.participants_id_seq1 OWNED BY public.participants.id;


--
-- Name: submissions; Type: TABLE; Schema: public; Owner: jumana_bountyapp
--

CREATE TABLE public.submissions (
    id bigint NOT NULL,
    chain_id bigint NOT NULL,
    escrow_address character varying(42) NOT NULL,
    submission_id numeric(78,0) NOT NULL,
    bounty_id numeric(78,0) NOT NULL,
    tester_address character varying(42) NOT NULL,
    report_hash character(66) NOT NULL,
    encrypted_evidence_cid text NOT NULL,
    rejection_reason_hash character(66),
    requested_reward_wei numeric(78,0) NOT NULL,
    approved_reward_wei numeric(78,0) DEFAULT 0 NOT NULL,
    submitted_at timestamp with time zone NOT NULL,
    rejected_at timestamp with time zone,
    status smallint NOT NULL,
    submission_tx_hash character(66) NOT NULL,
    block_number bigint NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    tester_organization_id character(66)
);


ALTER TABLE public.submissions OWNER TO jumana_bountyapp;

--
-- Name: submissions_id_seq; Type: SEQUENCE; Schema: public; Owner: jumana_bountyapp
--

CREATE SEQUENCE public.submissions_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.submissions_id_seq OWNER TO jumana_bountyapp;

--
-- Name: submissions_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: jumana_bountyapp
--

ALTER SEQUENCE public.submissions_id_seq OWNED BY public.submissions.id;


--
-- Name: tester_registration_challenges; Type: TABLE; Schema: public; Owner: jumana_bountyapp
--

CREATE TABLE public.tester_registration_challenges (
    id uuid NOT NULL,
    wallet_address character varying(42) NOT NULL,
    registration_payload_hash character(66) NOT NULL,
    challenge_message text NOT NULL,
    expires_at timestamp with time zone NOT NULL,
    used_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT tester_registration_challenge_expiry_check CHECK ((expires_at > created_at))
);


ALTER TABLE public.tester_registration_challenges OWNER TO jumana_bountyapp;

--
-- Name: vulnerability_reports; Type: TABLE; Schema: public; Owner: jumana_bountyapp
--

CREATE TABLE public.vulnerability_reports (
    id bigint NOT NULL,
    bounty_db_id bigint NOT NULL,
    tester_id bigint NOT NULL,
    tester_wallet character varying(42) NOT NULL,
    title character varying(200) NOT NULL,
    severity character varying(10) NOT NULL,
    description text NOT NULL,
    steps_to_reproduce text NOT NULL,
    evidence_url text,
    report_hash character(66) NOT NULL,
    status character varying(20) DEFAULT 'submitted'::character varying NOT NULL,
    approved_reward_wei numeric(78,0),
    payout_nonce numeric(78,0),
    payout_deadline timestamp with time zone,
    company_signature text,
    reviewed_at timestamp with time zone,
    claimed_at timestamp with time zone,
    claim_transaction_hash character(66),
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT vulnerability_reports_severity_check CHECK (((severity)::text = ANY ((ARRAY['Critical'::character varying, 'High'::character varying, 'Medium'::character varying, 'Low'::character varying])::text[]))),
    CONSTRAINT vulnerability_reports_status_check CHECK (((status)::text = ANY ((ARRAY['submitted'::character varying, 'rejected'::character varying, 'accepted'::character varying, 'claimed'::character varying])::text[])))
);


ALTER TABLE public.vulnerability_reports OWNER TO jumana_bountyapp;

--
-- Name: vulnerability_reports_id_seq; Type: SEQUENCE; Schema: public; Owner: jumana_bountyapp
--

CREATE SEQUENCE public.vulnerability_reports_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.vulnerability_reports_id_seq OWNER TO jumana_bountyapp;

--
-- Name: vulnerability_reports_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: jumana_bountyapp
--

ALTER SEQUENCE public.vulnerability_reports_id_seq OWNED BY public.vulnerability_reports.id;


--
-- Name: authorization_issuances id; Type: DEFAULT; Schema: public; Owner: jumana_bountyapp
--

ALTER TABLE ONLY public.authorization_issuances ALTER COLUMN id SET DEFAULT nextval('public.authorization_issuances_id_seq'::regclass);


--
-- Name: blockchain_events id; Type: DEFAULT; Schema: public; Owner: jumana_bountyapp
--

ALTER TABLE ONLY public.blockchain_events ALTER COLUMN id SET DEFAULT nextval('public.blockchain_events_id_seq'::regclass);


--
-- Name: bounties id; Type: DEFAULT; Schema: public; Owner: jumana_bountyapp
--

ALTER TABLE ONLY public.bounties ALTER COLUMN id SET DEFAULT nextval('public.bounties_id_seq'::regclass);


--
-- Name: bounty_metadata id; Type: DEFAULT; Schema: public; Owner: jumana_bountyapp
--

ALTER TABLE ONLY public.bounty_metadata ALTER COLUMN id SET DEFAULT nextval('public.bounty_metadata_id_seq'::regclass);


--
-- Name: participants id; Type: DEFAULT; Schema: public; Owner: jumana_bountyapp
--

ALTER TABLE ONLY public.participants ALTER COLUMN id SET DEFAULT nextval('public.participants_id_seq1'::regclass);


--
-- Name: participants_onchain_legacy id; Type: DEFAULT; Schema: public; Owner: jumana_bountyapp
--

ALTER TABLE ONLY public.participants_onchain_legacy ALTER COLUMN id SET DEFAULT nextval('public.participants_id_seq'::regclass);


--
-- Name: submissions id; Type: DEFAULT; Schema: public; Owner: jumana_bountyapp
--

ALTER TABLE ONLY public.submissions ALTER COLUMN id SET DEFAULT nextval('public.submissions_id_seq'::regclass);


--
-- Name: vulnerability_reports id; Type: DEFAULT; Schema: public; Owner: jumana_bountyapp
--

ALTER TABLE ONLY public.vulnerability_reports ALTER COLUMN id SET DEFAULT nextval('public.vulnerability_reports_id_seq'::regclass);


--
-- Data for Name: authorization_issuances; Type: TABLE DATA; Schema: public; Owner: jumana_bountyapp
--

COPY public.authorization_issuances (id, wallet_address, participant_type, organization_id, action, action_hash, nonce, deadline, chain_id, verifying_contract, verifier_address, authorization_digest, signature, status, used_transaction_hash, issued_at, used_at) FROM stdin;
1	0x70997970c51812dc3a010c7d01b50e0d17dc79c8	1	0xd5d43b9f4c01fdddc963242d1f298ce6061971d7446209c8b341c5cc7eec9f38	1	0x58e4487d93d41ad090f52ca32cf84fd63b9f98da34c23d31aaaa896eff842787	0	2026-08-06 21:19:21+06	31337	0x5fbdb2315678afecb367f032d93f642f64180aa3	0x90f79bf6eb2c4f870365e785982e1f101e93b906	0xb73b13f1d4f54a336c4c48fbc0ce82672c232b0b8c24aa65fc1710d00d88b421	0x905e8e0e76f70c0a1a2f43e38569424658fee97f14555d4133e3a14391a4b9d754ffd525246e4086d3d78367d68a6943e7d650498d5048c99882f1fde7ec431f1b	used	0x7a86de3c79bce5d4fedc88d0c9ac8c6e2227b66120fa16aee1b62686b1681b6e	2026-08-06 21:14:21.367987+06	2026-08-06 21:14:20+06
2	0x70997970c51812dc3a010c7d01b50e0d17dc79c8	1	0xd5d43b9f4c01fdddc963242d1f298ce6061971d7446209c8b341c5cc7eec9f38	1	0x99a49c6226856372657d62d2c2ca586a3eea918f903f20f9c6f53728702ae769	0	2026-08-20 23:12:39+06	31337	0x5fbdb2315678afecb367f032d93f642f64180aa3	0x90f79bf6eb2c4f870365e785982e1f101e93b906	0x96a904e05ec3626ed21d2ac83a500c61ab33240fea5944e261d346adead89244	0x90e62207a9c9e7eb9fa9f62c42e50d789d87ff3dfc20fc7d20db34c23f98286b36a7df104b652a7c82900db8b1ef8f8331189c759c070c857fb8d89154348ee31c	issued	\N	2026-08-20 23:07:39.516335+06	\N
3	0x70997970c51812dc3a010c7d01b50e0d17dc79c8	1	0xd5d43b9f4c01fdddc963242d1f298ce6061971d7446209c8b341c5cc7eec9f38	1	0xde63cb70dd81fef8f8e88add3b65bb341c1feaae2bfd9ba75c48c7cb04352fca	0	2026-08-20 23:33:25+06	31337	0x5fbdb2315678afecb367f032d93f642f64180aa3	0x90f79bf6eb2c4f870365e785982e1f101e93b906	0x9f60a0dc587b32ba50172a1ea0968e390aa4dd7f4245d55692b6dfc3e3e068f0	0x7ff48c609d8b6074dfdbb43201646b351dfc83d19f262943ca3e1f9a70c4d1df61bd86011d5f93973f22a7b8f84f7c1e31e3a7329d29a5ef54515ff56fce79451b	issued	\N	2026-08-20 23:28:25.71675+06	\N
4	0x70997970c51812dc3a010c7d01b50e0d17dc79c8	1	0xd5d43b9f4c01fdddc963242d1f298ce6061971d7446209c8b341c5cc7eec9f38	1	0xa0f6e4bc0eb6a5ad9803da94539c5ca38a1ac58d1727d73056e2deec5589635c	0	2026-08-21 01:00:04+06	31337	0x5fbdb2315678afecb367f032d93f642f64180aa3	0x90f79bf6eb2c4f870365e785982e1f101e93b906	0xd327e48ad5178ed59f2d5efcbfea2976c0279ba8373c639961734a7834b7997f	0x4e6af11a8f60b7a1a2740991bc11c7378785221d4b227c9f66eaa47e22c0b7df1adfbb4e12c16ded2733ee199021885c92efef409330568cc856639fa792edde1b	issued	\N	2026-08-21 00:55:04.724461+06	\N
5	0x70997970c51812dc3a010c7d01b50e0d17dc79c8	1	0xd5d43b9f4c01fdddc963242d1f298ce6061971d7446209c8b341c5cc7eec9f38	1	0xb86f08e8847527f4e74595d7dcf2e64f474563945401fb8d938efbdc06c2e2b1	0	2026-08-27 01:35:17+06	2026	0x95d6a2ed2b326170bf524f712d3acbf5540b4de3	0xee75e7826372e1edd7db15af807a9f02751756a4	0x10c0015eb4acbbf48f8ab03b6cb533a7f663c614919bf739f1146e96aff6c1ae	0x0b244259eef435cfd6a51bb8cfcad0b4f09eee6203e8720dc721246c0d996995085c74501173785d377aba9ae835259e077e9b31e167b1cacaad4661a6d9e1c31c	issued	\N	2026-08-27 01:30:17.080962+06	\N
\.


--
-- Data for Name: blockchain_events; Type: TABLE DATA; Schema: public; Owner: jumana_bountyapp
--

COPY public.blockchain_events (id, chain_id, contract_address, event_name, transaction_hash, log_index, block_number, block_hash, event_data, processed_at) FROM stdin;
1	31337	0x9fe46736679d2d9a65f0992f2272de9f3c7fa6e0	ParticipantRegistered	0x85615a507d6214d4d2eae5d836184d36b7f67b76e478d2fec291b23e010ce334	0	10	0xe81a8ab54f2680f41fe129a1b8be0e7a14d36d2f27af51e36d78d1307a34d8fe	{"account": "0x70997970C51812dc3A010C7d01b50e0d17dc79C8", "organizationId": "0xd5d43b9f4c01fdddc963242d1f298ce6061971d7446209c8b341c5cc7eec9f38", "participantType": 1}	2026-08-04 23:11:24.188057+06
2	31337	0x9fe46736679d2d9a65f0992f2272de9f3c7fa6e0	ParticipantRegistered	0x9bd6cb90f8fc7834caed3bc1176ce3f91a998ad34130e0e2254c5bbde16cf256	0	11	0x29096e80a5c2d0223a1fcb5b99c13e6f2d05371b1ad25256e62d9c49294b8aba	{"account": "0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC", "organizationId": "0x0cc194c55e0f90cd47a54ea7ddf8a9cee647acf865624fe21b2bb262598d43bc", "participantType": 2}	2026-08-04 23:11:24.258878+06
\.


--
-- Data for Name: bounties; Type: TABLE DATA; Schema: public; Owner: jumana_bountyapp
--

COPY public.bounties (id, chain_id, escrow_address, bounty_id, company_address, metadata_hash, metadata_cid, total_escrow_wei, available_escrow_wei, start_time, end_time, refund_available_at, status, creation_tx_hash, block_number, created_at, updated_at, company_organization_id) FROM stdin;
1	31337	0x5fbdb2315678afecb367f032d93f642f64180aa3	1	0x70997970c51812dc3a010c7d01b50e0d17dc79c8	0x67f4822efd20cf5542e48c20efea9ee69df9b53002bf7080cd46c88fbbb91726	ipfs://local-integration-bounty	500000000000000000	500000000000000000	2026-08-06 21:14:20+06	2026-08-13 21:03:31+06	2026-08-13 21:03:31+06	1	0x7a86de3c79bce5d4fedc88d0c9ac8c6e2227b66120fa16aee1b62686b1681b6e	2	2026-08-06 21:47:16.664275+06	2026-08-06 21:47:16.664275+06	0xd5d43b9f4c01fdddc963242d1f298ce6061971d7446209c8b341c5cc7eec9f38
\.


--
-- Data for Name: bounty_metadata; Type: TABLE DATA; Schema: public; Owner: jumana_bountyapp
--

COPY public.bounty_metadata (id, bounty_id, title, description, severity, scope, created_at) FROM stdin;
1	1	Web Application Security Program	Find vulnerabilities in authentication and API systems	Critical	Authentication, authorization, API endpoints	2026-09-01 10:35:42.624779
\.


--
-- Data for Name: company_registration_challenges; Type: TABLE DATA; Schema: public; Owner: jumana_bountyapp
--

COPY public.company_registration_challenges (id, wallet_address, registration_payload_hash, challenge_message, expires_at, used_at, created_at) FROM stdin;
561e6748-4c66-482f-96f7-d4e917e22b4c	0x9fea983a4a930abfa3f31813636408968d0b6ae6	0x5c1a4605474b4e244819c894aeec2a843f99a98c2e7a771b253aff122a1c5c2c	Register Company - Bug Bounty Security Journal\n\nSign this message to prove that you control the wallet used for this company registration.\n\nWallet: 0x9FEa983a4a930abfA3f31813636408968D0B6AE6\nCompany: Test Security Ltd\nRegistration Hash: 0x5c1a4605474b4e244819c894aeec2a843f99a98c2e7a771b253aff122a1c5c2c\nChallenge ID: 561e6748-4c66-482f-96f7-d4e917e22b4c\nIssued At: 2026-08-07T17:51:27.036Z\nExpires At: 2026-08-07T17:56:27.036Z\n\nThis signature does not create a blockchain transaction and does not cost gas.	2026-08-07 23:56:27.036+06	2026-08-08 00:59:15.511723+06	2026-08-07 23:51:27.037469+06
7d00ccd6-73d7-4503-b381-2f8a89f18fd7	0x9fea983a4a930abfa3f31813636408968d0b6ae6	0x7b7b6a9f023ccf83fcc812df8e5f0f806de819b3e842a0e126e12b69f6434aea	Register Company - Bug Bounty Security Journal\n\nSign this message to prove that you control the wallet used for this company registration.\n\nWallet: 0x9FEa983a4a930abfA3f31813636408968D0B6AE6\nCompany: SecureSoft Ltd.\nRegistration Hash: 0x7b7b6a9f023ccf83fcc812df8e5f0f806de819b3e842a0e126e12b69f6434aea\nChallenge ID: 7d00ccd6-73d7-4503-b381-2f8a89f18fd7\nIssued At: 2026-08-07T18:59:15.509Z\nExpires At: 2026-08-07T19:04:15.509Z\n\nThis signature does not create a blockchain transaction and does not cost gas.	2026-08-08 01:04:15.509+06	2026-08-08 00:59:30.152352+06	2026-08-08 00:59:15.511723+06
\.


--
-- Data for Name: login_challenges; Type: TABLE DATA; Schema: public; Owner: jumana_bountyapp
--

COPY public.login_challenges (id, participant_id, wallet_address, challenge_message, expires_at, used_at, created_at) FROM stdin;
b02f3b04-3c6d-46dc-84a8-bf3b8d7f6a57	1	0x70997970c51812dc3a010c7d01b50e0d17dc79c8	Sign in to Bug Bounty Security Journal\n\nThis signature proves that you control the connected wallet.\nIt does not create a blockchain transaction and does not cost gas.\n\nCompany: Verified Company\nWallet: 0x70997970C51812dc3A010C7d01b50e0d17dc79C8\nChallenge ID: b02f3b04-3c6d-46dc-84a8-bf3b8d7f6a57\nIssued At: 2026-08-06T17:02:15.219Z\nExpires At: 2026-08-06T17:07:15.219Z	2026-08-06 23:07:15.219+06	2026-08-07 23:27:40.058459+06	2026-08-06 23:02:15.222393+06
59e44dd0-9ce0-4f08-9fac-4bd6bc2da730	1	0x70997970c51812dc3a010c7d01b50e0d17dc79c8	Sign in to Bug Bounty Security Journal\n\nThis signature proves that you control the connected wallet.\nIt does not create a blockchain transaction and does not cost gas.\n\nCompany: Verified Company\nWallet: 0x70997970C51812dc3A010C7d01b50e0d17dc79C8\nChallenge ID: 59e44dd0-9ce0-4f08-9fac-4bd6bc2da730\nIssued At: 2026-08-07T17:27:40.056Z\nExpires At: 2026-08-07T17:32:40.056Z	2026-08-07 23:32:40.056+06	2026-08-07 23:28:13.502185+06	2026-08-07 23:27:40.058459+06
9c9177c7-e885-4d4d-86f5-1ccba0d3f45c	5	0x9fea983a4a930abfa3f31813636408968d0b6ae6	Sign in to Bug Bounty Security Journal\n\nThis signature proves that you control the connected wallet.\nIt does not create a blockchain transaction and does not cost gas.\n\nCompany: SecureSoft Ltd.\nWallet: 0x9FEa983a4a930abfA3f31813636408968D0B6AE6\nChallenge ID: 9c9177c7-e885-4d4d-86f5-1ccba0d3f45c\nIssued At: 2026-08-11T17:14:42.598Z\nExpires At: 2026-08-11T17:19:42.598Z	2026-08-11 23:19:42.598+06	2026-08-11 23:14:48.000819+06	2026-08-11 23:14:42.602839+06
a861c3b2-1273-480d-9db0-94279a5ae81f	5	0x9fea983a4a930abfa3f31813636408968d0b6ae6	Sign in to Bug Bounty Security Journal\n\nThis signature proves that you control the connected wallet.\nIt does not create a blockchain transaction and does not cost gas.\n\nCompany: SecureSoft Ltd.\nWallet: 0x9FEa983a4a930abfA3f31813636408968D0B6AE6\nChallenge ID: a861c3b2-1273-480d-9db0-94279a5ae81f\nIssued At: 2026-08-11T17:53:49.251Z\nExpires At: 2026-08-11T17:58:49.251Z	2026-08-11 23:58:49.251+06	2026-08-11 23:54:03.304071+06	2026-08-11 23:53:49.252691+06
34b78ffb-8396-44e2-aad3-dda2027521f6	5	0x9fea983a4a930abfa3f31813636408968d0b6ae6	Sign in to Bug Bounty Security Journal\n\nThis signature proves that you control the connected wallet.\nIt does not create a blockchain transaction and does not cost gas.\n\nCompany: SecureSoft Ltd.\nWallet: 0x9FEa983a4a930abfA3f31813636408968D0B6AE6\nChallenge ID: 34b78ffb-8396-44e2-aad3-dda2027521f6\nIssued At: 2026-08-11T17:54:14.835Z\nExpires At: 2026-08-11T17:59:14.835Z	2026-08-11 23:59:14.835+06	2026-08-11 23:54:28.604212+06	2026-08-11 23:54:14.836708+06
55ba9601-7666-4df3-8fcb-4c8f7e5e3b79	5	0x9fea983a4a930abfa3f31813636408968d0b6ae6	Sign in to Bug Bounty Security Journal\n\nThis signature proves that you control the connected wallet.\nIt does not create a blockchain transaction and does not cost gas.\n\nCompany: SecureSoft Ltd.\nWallet: 0x9FEa983a4a930abfA3f31813636408968D0B6AE6\nChallenge ID: 55ba9601-7666-4df3-8fcb-4c8f7e5e3b79\nIssued At: 2026-08-11T18:17:13.078Z\nExpires At: 2026-08-11T18:22:13.078Z	2026-08-12 00:22:13.078+06	2026-08-12 00:17:19.926619+06	2026-08-12 00:17:13.080023+06
93c6f360-0671-41e1-8244-522e38f26cc7	5	0x9fea983a4a930abfa3f31813636408968d0b6ae6	Sign in to Bug Bounty Security Journal\n\nThis signature proves that you control the connected wallet.\nIt does not create a blockchain transaction and does not cost gas.\n\nCompany: SecureSoft Ltd.\nWallet: 0x9FEa983a4a930abfA3f31813636408968D0B6AE6\nChallenge ID: 93c6f360-0671-41e1-8244-522e38f26cc7\nIssued At: 2026-08-17T14:59:43.291Z\nExpires At: 2026-08-17T15:04:43.291Z	2026-08-17 21:04:43.291+06	2026-08-17 21:00:05.26949+06	2026-08-17 20:59:43.292849+06
ea476916-37b6-4515-8d99-d3f6322f6bf9	5	0x9fea983a4a930abfa3f31813636408968d0b6ae6	Sign in to Bug Bounty Security Journal\n\nThis signature proves that you control the connected wallet.\nIt does not create a blockchain transaction and does not cost gas.\n\nCompany: SecureSoft Ltd.\nWallet: 0x9FEa983a4a930abfA3f31813636408968D0B6AE6\nChallenge ID: ea476916-37b6-4515-8d99-d3f6322f6bf9\nIssued At: 2026-08-19T02:06:39.650Z\nExpires At: 2026-08-19T02:11:39.650Z	2026-08-19 08:11:39.65+06	2026-08-19 08:08:26.912357+06	2026-08-19 08:06:39.654014+06
43e87ca8-068e-4253-914f-debe0ef5221e	5	0x9fea983a4a930abfa3f31813636408968d0b6ae6	Sign in to Bug Bounty Security Journal\n\nThis signature proves that you control the connected wallet.\nIt does not create a blockchain transaction and does not cost gas.\n\nCompany: SecureSoft Ltd.\nWallet: 0x9FEa983a4a930abfA3f31813636408968D0B6AE6\nChallenge ID: 43e87ca8-068e-4253-914f-debe0ef5221e\nIssued At: 2026-08-19T02:08:26.910Z\nExpires At: 2026-08-19T02:13:26.910Z	2026-08-19 08:13:26.91+06	2026-08-19 08:08:34.117391+06	2026-08-19 08:08:26.912357+06
a54b4570-e6d2-4c96-8961-09ee72e1c945	5	0x9fea983a4a930abfa3f31813636408968d0b6ae6	Sign in to Bug Bounty Security Journal\n\nThis signature proves that you control the connected wallet.\nIt does not create a blockchain transaction and does not cost gas.\n\nCompany: SecureSoft Ltd.\nWallet: 0x9FEa983a4a930abfA3f31813636408968D0B6AE6\nChallenge ID: a54b4570-e6d2-4c96-8961-09ee72e1c945\nIssued At: 2026-08-19T02:10:23.887Z\nExpires At: 2026-08-19T02:15:23.887Z	2026-08-19 08:15:23.887+06	2026-08-19 08:10:28.625195+06	2026-08-19 08:10:23.889349+06
41d9ef1f-cafd-48bd-90c6-7e69cf6b3f64	5	0x9fea983a4a930abfa3f31813636408968d0b6ae6	Sign in to Bug Bounty Security Journal\n\nThis signature proves that you control the connected wallet.\nIt does not create a blockchain transaction and does not cost gas.\n\nCompany: SecureSoft Ltd.\nWallet: 0x9FEa983a4a930abfA3f31813636408968D0B6AE6\nChallenge ID: 41d9ef1f-cafd-48bd-90c6-7e69cf6b3f64\nIssued At: 2026-08-20T15:54:31.458Z\nExpires At: 2026-08-20T15:59:31.458Z	2026-08-20 21:59:31.458+06	2026-08-20 21:54:51.677854+06	2026-08-20 21:54:31.462044+06
90816d6f-d2be-4995-99e7-0c6b5f3d5171	1	0x70997970c51812dc3a010c7d01b50e0d17dc79c8	Sign in to Bug Bounty Security Journal\n\nThis signature proves that you control the connected wallet.\nIt does not create a blockchain transaction and does not cost gas.\n\nCompany: Verified Company\nWallet: 0x70997970C51812dc3A010C7d01b50e0d17dc79C8\nChallenge ID: 90816d6f-d2be-4995-99e7-0c6b5f3d5171\nIssued At: 2026-08-20T17:05:41.974Z\nExpires At: 2026-08-20T17:10:41.974Z	2026-08-20 23:10:41.974+06	2026-08-20 23:05:45.012156+06	2026-08-20 23:05:41.977186+06
f231452f-1ee3-47c6-a418-0342aceac330	1	0x70997970c51812dc3a010c7d01b50e0d17dc79c8	Sign in to Bug Bounty Security Journal\n\nThis signature proves that you control the connected wallet.\nIt does not create a blockchain transaction and does not cost gas.\n\nCompany: Verified Company\nWallet: 0x70997970C51812dc3A010C7d01b50e0d17dc79C8\nChallenge ID: f231452f-1ee3-47c6-a418-0342aceac330\nIssued At: 2026-08-22T13:53:33.919Z\nExpires At: 2026-08-22T13:58:33.919Z	2026-08-22 19:58:33.919+06	2026-08-22 19:53:54.788287+06	2026-08-22 19:53:33.923178+06
94502f37-23da-48b4-b4a7-28528686fe5f	12	0x2546bcd3c84621e976d8185a91a922ae77ecec30	Sign in to BugBounty\n\nThis signature proves that you control the connected Bug Hunter wallet.\nIt does not create a blockchain transaction and does not cost gas.\n\nBug Hunter: Unknown\nWallet: 0x2546BcD3c84621e976D8185a91A922aE77ECEc30\nChallenge ID: 94502f37-23da-48b4-b4a7-28528686fe5f\nIssued At: 2026-08-26T16:09:06.604Z\nExpires At: 2026-08-26T16:14:06.604Z	2026-08-26 22:14:06.604+06	2026-08-26 22:09:24.988831+06	2026-08-26 22:09:06.622253+06
5485ead0-c9e4-457d-89de-b1b0591d9b78	1	0x70997970c51812dc3a010c7d01b50e0d17dc79c8	Sign in to Bug Bounty Security Journal\n\nThis signature proves that you control the connected wallet.\nIt does not create a blockchain transaction and does not cost gas.\n\nCompany: Verified Company\nWallet: 0x70997970C51812dc3A010C7d01b50e0d17dc79C8\nChallenge ID: 5485ead0-c9e4-457d-89de-b1b0591d9b78\nIssued At: 2026-08-26T18:12:26.324Z\nExpires At: 2026-08-26T18:17:26.324Z	2026-08-27 00:17:26.324+06	2026-08-27 00:12:29.471778+06	2026-08-27 00:12:26.327649+06
35e19722-c83d-4316-8b9e-c89eacfc15b4	1	0x70997970c51812dc3a010c7d01b50e0d17dc79c8	Sign in to Bug Bounty Security Journal\n\nThis signature proves that you control the connected wallet.\nIt does not create a blockchain transaction and does not cost gas.\n\nCompany: Verified Company\nWallet: 0x70997970C51812dc3A010C7d01b50e0d17dc79C8\nChallenge ID: 35e19722-c83d-4316-8b9e-c89eacfc15b4\nIssued At: 2026-08-26T18:32:36.132Z\nExpires At: 2026-08-26T18:37:36.132Z	2026-08-27 00:37:36.132+06	2026-08-27 00:32:45.630817+06	2026-08-27 00:32:36.13447+06
985fa696-1cec-4df4-9474-adfc24ecbc33	1	0x70997970c51812dc3a010c7d01b50e0d17dc79c8	Sign in to Bug Bounty Security Journal\n\nThis signature proves that you control the connected wallet.\nIt does not create a blockchain transaction and does not cost gas.\n\nCompany: Verified Company\nWallet: 0x70997970C51812dc3A010C7d01b50e0d17dc79C8\nChallenge ID: 985fa696-1cec-4df4-9474-adfc24ecbc33\nIssued At: 2026-08-26T18:43:27.383Z\nExpires At: 2026-08-26T18:48:27.383Z	2026-08-27 00:48:27.383+06	2026-08-27 00:43:30.296461+06	2026-08-27 00:43:27.385699+06
817a52cc-c22f-4dc2-9e25-413a12ab79a9	12	0x2546bcd3c84621e976d8185a91a922ae77ecec30	Sign in to BugBounty\n\nThis signature proves that you control the connected Bug Hunter wallet.\nIt does not create a blockchain transaction and does not cost gas.\n\nBug Hunter: Unknown\nWallet: 0x2546BcD3c84621e976D8185a91A922aE77ECEc30\nChallenge ID: 817a52cc-c22f-4dc2-9e25-413a12ab79a9\nIssued At: 2026-08-31T07:07:11.498Z\nExpires At: 2026-08-31T07:12:11.498Z	2026-08-31 13:12:11.498+06	2026-08-31 13:07:15.147124+06	2026-08-31 13:07:11.523232+06
adee820a-dd36-44dc-97ad-6d70298f5e08	12	0x2546bcd3c84621e976d8185a91a922ae77ecec30	Sign in to BugBounty\n\nThis signature proves that you control the connected Bug Hunter wallet.\nIt does not create a blockchain transaction and does not cost gas.\n\nBug Hunter: Unknown\nWallet: 0x2546BcD3c84621e976D8185a91A922aE77ECEc30\nChallenge ID: adee820a-dd36-44dc-97ad-6d70298f5e08\nIssued At: 2026-08-31T10:58:24.955Z\nExpires At: 2026-08-31T11:03:24.955Z	2026-08-31 17:03:24.955+06	2026-08-31 16:59:23.756741+06	2026-08-31 16:58:24.967371+06
df71a89d-2ae0-4836-948f-d6aceaca44f1	12	0x2546bcd3c84621e976d8185a91a922ae77ecec30	Sign in to BugBounty\n\nThis signature proves that you control the connected Bug Hunter wallet.\nIt does not create a blockchain transaction and does not cost gas.\n\nBug Hunter: Unknown\nWallet: 0x2546BcD3c84621e976D8185a91A922aE77ECEc30\nChallenge ID: df71a89d-2ae0-4836-948f-d6aceaca44f1\nIssued At: 2026-08-31T10:59:23.753Z\nExpires At: 2026-08-31T11:04:23.753Z	2026-08-31 17:04:23.753+06	2026-08-31 16:59:27.171072+06	2026-08-31 16:59:23.767692+06
ec50d8c1-a81f-4aea-9586-ef9c13692747	12	0x2546bcd3c84621e976d8185a91a922ae77ecec30	Sign in to BugBounty\n\nThis signature proves that you control the connected Bug Hunter wallet.\nIt does not create a blockchain transaction and does not cost gas.\n\nBug Hunter: Unknown\nWallet: 0x2546BcD3c84621e976D8185a91A922aE77ECEc30\nChallenge ID: ec50d8c1-a81f-4aea-9586-ef9c13692747\nIssued At: 2026-08-31T19:19:53.577Z\nExpires At: 2026-08-31T19:24:53.577Z	2026-09-01 01:24:53.577+06	2026-09-01 01:20:22.089071+06	2026-09-01 01:19:53.591587+06
46074d82-b3e3-4455-afc4-232a710f6a5c	12	0x2546bcd3c84621e976d8185a91a922ae77ecec30	Sign in to BugBounty\n\nThis signature proves that you control the connected Bug Hunter wallet.\nIt does not create a blockchain transaction and does not cost gas.\n\nBug Hunter: Unknown\nWallet: 0x2546BcD3c84621e976D8185a91A922aE77ECEc30\nChallenge ID: 46074d82-b3e3-4455-afc4-232a710f6a5c\nIssued At: 2026-08-31T19:20:37.605Z\nExpires At: 2026-08-31T19:25:37.605Z	2026-09-01 01:25:37.605+06	2026-09-01 01:20:41.984985+06	2026-09-01 01:20:37.608829+06
e7e1c542-2e51-4caf-bae0-b7f5b830341f	12	0x2546bcd3c84621e976d8185a91a922ae77ecec30	Sign in to BugBounty\n\nThis signature proves that you control the connected Bug Hunter wallet.\nIt does not create a blockchain transaction and does not cost gas.\n\nBug Hunter: Unknown\nWallet: 0x2546BcD3c84621e976D8185a91A922aE77ECEc30\nChallenge ID: e7e1c542-2e51-4caf-bae0-b7f5b830341f\nIssued At: 2026-08-31T19:22:32.452Z\nExpires At: 2026-08-31T19:27:32.452Z	2026-09-01 01:27:32.452+06	2026-09-01 01:22:34.573454+06	2026-09-01 01:22:32.463374+06
40bde0c2-00cc-4f04-9d23-c0dc2cc94325	12	0x2546bcd3c84621e976d8185a91a922ae77ecec30	Sign in to BugBounty\n\nThis signature proves that you control the connected Bug Hunter wallet.\nIt does not create a blockchain transaction and does not cost gas.\n\nBug Hunter: Unknown\nWallet: 0x2546BcD3c84621e976D8185a91A922aE77ECEc30\nChallenge ID: 40bde0c2-00cc-4f04-9d23-c0dc2cc94325\nIssued At: 2026-08-31T19:25:18.481Z\nExpires At: 2026-08-31T19:30:18.481Z	2026-09-01 01:30:18.481+06	2026-09-01 01:25:23.945885+06	2026-09-01 01:25:18.490786+06
660af099-2e9e-496f-a076-33fb07cc37e2	12	0x2546bcd3c84621e976d8185a91a922ae77ecec30	Sign in to BugBounty\n\nThis signature proves that you control the connected Bug Hunter wallet.\nIt does not create a blockchain transaction and does not cost gas.\n\nBug Hunter: Unknown\nWallet: 0x2546BcD3c84621e976D8185a91A922aE77ECEc30\nChallenge ID: 660af099-2e9e-496f-a076-33fb07cc37e2\nIssued At: 2026-08-31T19:27:06.569Z\nExpires At: 2026-08-31T19:32:06.569Z	2026-09-01 01:32:06.569+06	2026-09-01 01:27:10.158689+06	2026-09-01 01:27:06.579147+06
7ef0020f-df0b-4a0b-920d-285d16550361	12	0x2546bcd3c84621e976d8185a91a922ae77ecec30	Sign in to BugBounty\n\nThis signature proves that you control the connected Bug Hunter wallet.\nIt does not create a blockchain transaction and does not cost gas.\n\nBug Hunter: Unknown\nWallet: 0x2546BcD3c84621e976D8185a91A922aE77ECEc30\nChallenge ID: 7ef0020f-df0b-4a0b-920d-285d16550361\nIssued At: 2026-09-01T04:19:49.038Z\nExpires At: 2026-09-01T04:24:49.038Z	2026-09-01 10:24:49.038+06	2026-09-01 10:20:04.837259+06	2026-09-01 10:19:49.052428+06
d99fb5e2-a2b8-434b-b942-06e5c4273b93	12	0x2546bcd3c84621e976d8185a91a922ae77ecec30	Sign in to BugBounty\n\nThis signature proves that you control the connected Bug Hunter wallet.\nIt does not create a blockchain transaction and does not cost gas.\n\nBug Hunter: Unknown\nWallet: 0x2546BcD3c84621e976D8185a91A922aE77ECEc30\nChallenge ID: d99fb5e2-a2b8-434b-b942-06e5c4273b93\nIssued At: 2026-09-01T05:02:30.074Z\nExpires At: 2026-09-01T05:07:30.074Z	2026-09-01 11:07:30.074+06	2026-09-01 11:02:36.172529+06	2026-09-01 11:02:30.083905+06
fda8cf3a-c768-48d6-baca-fbf9591b4636	1	0x70997970c51812dc3a010c7d01b50e0d17dc79c8	Sign in to Bug Bounty Security Journal\n\nThis signature proves that you control the connected wallet.\nIt does not create a blockchain transaction and does not cost gas.\n\nCompany: Verified Company\nWallet: 0x70997970C51812dc3A010C7d01b50e0d17dc79C8\nChallenge ID: fda8cf3a-c768-48d6-baca-fbf9591b4636\nIssued At: 2026-09-01T06:11:06.193Z\nExpires At: 2026-09-01T06:16:06.193Z	2026-09-01 12:16:06.193+06	2026-09-01 12:11:11.141185+06	2026-09-01 12:11:06.195482+06
\.


--
-- Data for Name: participants; Type: TABLE DATA; Schema: public; Owner: jumana_bountyapp
--

COPY public.participants (id, wallet_address, participant_type, organization_id, active, verified, validator_candidate, display_name, email, company_name, profile_data, verified_at, created_at, updated_at, username) FROM stdin;
1	0x70997970c51812dc3a010c7d01b50e0d17dc79c8	1	0xd5d43b9f4c01fdddc963242d1f298ce6061971d7446209c8b341c5cc7eec9f38	t	t	f	\N	\N	\N	{}	2026-08-04 22:53:37+06	2026-08-04 23:11:24.188057+06	2026-08-04 23:11:24.188057+06	\N
2	0x3c44cdddb6a900fa2b585dd299e03d12fa4293bc	2	0x0cc194c55e0f90cd47a54ea7ddf8a9cee647acf865624fe21b2bb262598d43bc	t	t	f	\N	\N	\N	{}	2026-08-04 22:53:38+06	2026-08-04 23:11:24.258878+06	2026-08-04 23:11:24.258878+06	\N
3	0x70997970c51812dc3a010c7d01b50e0d17dc79c8	1	0xd5d43b9f4c01fdddc963242d1f298ce6061971d7446209c8b341c5cc7eec9f38	t	t	f	Local Company	company.local@example.test	Software Company A	{}	2026-08-06 20:57:16.528012+06	2026-08-06 20:57:16.528012+06	2026-08-06 20:57:16.528012+06	\N
4	0x3c44cdddb6a900fa2b585dd299e03d12fa4293bc	2	0x0cc194c55e0f90cd47a54ea7ddf8a9cee647acf865624fe21b2bb262598d43bc	t	t	f	Local Tester	tester.local@example.test	\N	{}	2026-08-06 20:57:16.553924+06	2026-08-06 20:57:16.553924+06	2026-08-06 20:57:16.553924+06	\N
5	0x9fea983a4a930abfa3f31813636408968d0b6ae6	1	0x3be5f8abd4752c85178f50c4fb3938048eb7e0e25f4d83acc67eaa51cde4f29d	t	t	f	Jane Smith	muntahajumana@gmail.com	SecureSoft Ltd.	{"website": "https://company.com", "description": "this is company"}	2026-08-11 23:10:09.29744+06	2026-08-08 00:59:30.152352+06	2026-08-11 23:10:09.29744+06	\N
12	0x2546bcd3c84621e976d8185a91a922ae77ecec30	2	\N	t	t	f	whiteHacker	jumanamuntaha989@gmail.com	\N	{"username": "whiteHacker"}	\N	2026-08-23 01:28:03.02261+06	2026-08-23 01:28:03.02261+06	\N
\.


--
-- Data for Name: participants_onchain_legacy; Type: TABLE DATA; Schema: public; Owner: jumana_bountyapp
--

COPY public.participants_onchain_legacy (id, chain_id, registry_address, wallet_address, participant_type, organization_id, active, validator_candidate, registered_at, registration_tx_hash, block_number, created_at, updated_at) FROM stdin;
1	31337	0x9fe46736679d2d9a65f0992f2272de9f3c7fa6e0	0x70997970c51812dc3a010c7d01b50e0d17dc79c8	1	0xd5d43b9f4c01fdddc963242d1f298ce6061971d7446209c8b341c5cc7eec9f38	t	f	2026-08-04 22:53:37+06	0x85615a507d6214d4d2eae5d836184d36b7f67b76e478d2fec291b23e010ce334	10	2026-08-04 23:11:24.188057+06	2026-08-04 23:11:24.188057+06
2	31337	0x9fe46736679d2d9a65f0992f2272de9f3c7fa6e0	0x3c44cdddb6a900fa2b585dd299e03d12fa4293bc	2	0x0cc194c55e0f90cd47a54ea7ddf8a9cee647acf865624fe21b2bb262598d43bc	t	f	2026-08-04 22:53:38+06	0x9bd6cb90f8fc7834caed3bc1176ce3f91a998ad34130e0e2254c5bbde16cf256	11	2026-08-04 23:11:24.258878+06	2026-08-04 23:11:24.258878+06
\.


--
-- Data for Name: submissions; Type: TABLE DATA; Schema: public; Owner: jumana_bountyapp
--

COPY public.submissions (id, chain_id, escrow_address, submission_id, bounty_id, tester_address, report_hash, encrypted_evidence_cid, rejection_reason_hash, requested_reward_wei, approved_reward_wei, submitted_at, rejected_at, status, submission_tx_hash, block_number, created_at, updated_at, tester_organization_id) FROM stdin;
\.


--
-- Data for Name: tester_registration_challenges; Type: TABLE DATA; Schema: public; Owner: jumana_bountyapp
--

COPY public.tester_registration_challenges (id, wallet_address, registration_payload_hash, challenge_message, expires_at, used_at, created_at) FROM stdin;
d68097b7-43e3-4443-8ceb-3b76e2d6cc80	0x70997970c51812dc3a010c7d01b50e0d17dc79c8	0xf14954cd64a0ec418da3d6a18ec0a4a97bdeb8fe828e2a0d518b3d9fbffd53f0	BugBounty Tester Registration\n\nWallet:\n0x70997970C51812dc3A010C7d01b50e0d17dc79C8\n\nUsername:\nwhiteHacker\n\nEmail:\nmuntahajumana@gmail.com\n\nPayload Hash:\n0xf14954cd64a0ec418da3d6a18ec0a4a97bdeb8fe828e2a0d518b3d9fbffd53f0\n\nChallenge ID:\nd68097b7-43e3-4443-8ceb-3b76e2d6cc80	2026-08-23 00:38:55.655144+06	\N	2026-08-23 00:28:55.655144+06
6b312761-222d-4255-b1bb-b6ff72aa815a	0x70997970c51812dc3a010c7d01b50e0d17dc79c8	0xf14954cd64a0ec418da3d6a18ec0a4a97bdeb8fe828e2a0d518b3d9fbffd53f0	BugBounty Tester Registration\n\nWallet:\n0x70997970C51812dc3A010C7d01b50e0d17dc79C8\n\nUsername:\nwhiteHacker\n\nEmail:\nmuntahajumana@gmail.com\n\nPayload Hash:\n0xf14954cd64a0ec418da3d6a18ec0a4a97bdeb8fe828e2a0d518b3d9fbffd53f0\n\nChallenge ID:\n6b312761-222d-4255-b1bb-b6ff72aa815a	2026-08-23 00:42:01.752682+06	\N	2026-08-23 00:32:01.752682+06
8c381c46-ae2b-4cab-88b0-0487c99ee6f6	0x2546bcd3c84621e976d8185a91a922ae77ecec30	0x4bce298450582180b7545cbde7099f630c838b6a09ac48858e84223509d59ca1	BugBounty Tester Registration\n\nWallet:\n0x2546BcD3c84621e976D8185a91A922aE77ECEc30\n\nUsername:\nwhiteHacker\n\nEmail:\nmuntahajumana@gmail.com\n\nPayload Hash:\n0x4bce298450582180b7545cbde7099f630c838b6a09ac48858e84223509d59ca1\n\nChallenge ID:\n8c381c46-ae2b-4cab-88b0-0487c99ee6f6	2026-08-23 00:42:44.561646+06	\N	2026-08-23 00:32:44.561646+06
f923a18d-fed5-4a6f-a916-d742c3687cd5	0x2546bcd3c84621e976d8185a91a922ae77ecec30	0x4bce298450582180b7545cbde7099f630c838b6a09ac48858e84223509d59ca1	BugBounty Tester Registration\n\nWallet:\n0x2546BcD3c84621e976D8185a91A922aE77ECEc30\n\nUsername:\nwhiteHacker\n\nEmail:\nmuntahajumana@gmail.com\n\nPayload Hash:\n0x4bce298450582180b7545cbde7099f630c838b6a09ac48858e84223509d59ca1\n\nChallenge ID:\nf923a18d-fed5-4a6f-a916-d742c3687cd5	2026-08-23 00:42:54.552604+06	\N	2026-08-23 00:32:54.552604+06
b91de05f-c66a-4691-a0df-162b654fa8e2	0x2546bcd3c84621e976d8185a91a922ae77ecec30	0x4bce298450582180b7545cbde7099f630c838b6a09ac48858e84223509d59ca1	BugBounty Tester Registration\n\nWallet:\n0x2546BcD3c84621e976D8185a91A922aE77ECEc30\n\nUsername:\nwhiteHacker\n\nEmail:\nmuntahajumana@gmail.com\n\nPayload Hash:\n0x4bce298450582180b7545cbde7099f630c838b6a09ac48858e84223509d59ca1\n\nChallenge ID:\nb91de05f-c66a-4691-a0df-162b654fa8e2	2026-08-23 00:43:07.651536+06	\N	2026-08-23 00:33:07.651536+06
49d13880-6b16-4456-9465-6150d2fa3c0c	0x2546bcd3c84621e976d8185a91a922ae77ecec30	0x4bce298450582180b7545cbde7099f630c838b6a09ac48858e84223509d59ca1	BugBounty Tester Registration\n\nWallet:\n0x2546BcD3c84621e976D8185a91A922aE77ECEc30\n\nUsername:\nwhiteHacker\n\nEmail:\nmuntahajumana@gmail.com\n\nPayload Hash:\n0x4bce298450582180b7545cbde7099f630c838b6a09ac48858e84223509d59ca1\n\nChallenge ID:\n49d13880-6b16-4456-9465-6150d2fa3c0c	2026-08-23 00:45:59.796597+06	\N	2026-08-23 00:35:59.796597+06
af55f8f8-11e2-4676-929b-31f20ede2eb7	0x2546bcd3c84621e976d8185a91a922ae77ecec30	0x1656161bfadad029b4243a0560c940ec1a7cd287422e5c6b21c323387a6f6f45	BugBounty Tester Registration\n\nWallet:\n0x2546BcD3c84621e976D8185a91A922aE77ECEc30\n\nUsername:\nwhiteHacker\n\nEmail:\njumanamuntaha989@gmail.com\n\nPayload Hash:\n0x1656161bfadad029b4243a0560c940ec1a7cd287422e5c6b21c323387a6f6f45\n\nChallenge ID:\naf55f8f8-11e2-4676-929b-31f20ede2eb7	2026-08-23 01:33:55.138476+06	\N	2026-08-23 01:23:55.138476+06
45b9bb59-5208-40c6-930f-0aac14566d8e	0x2546bcd3c84621e976d8185a91a922ae77ecec30	0x1656161bfadad029b4243a0560c940ec1a7cd287422e5c6b21c323387a6f6f45	BugBounty Tester Registration\n\nWallet:\n0x2546BcD3c84621e976D8185a91A922aE77ECEc30\n\nUsername:\nwhiteHacker\n\nEmail:\njumanamuntaha989@gmail.com\n\nPayload Hash:\n0x1656161bfadad029b4243a0560c940ec1a7cd287422e5c6b21c323387a6f6f45\n\nChallenge ID:\n45b9bb59-5208-40c6-930f-0aac14566d8e	2026-08-23 01:35:30.027398+06	\N	2026-08-23 01:25:30.027398+06
25ae18a9-3574-4612-90a7-35109c3b0a92	0x2546bcd3c84621e976d8185a91a922ae77ecec30	0x1656161bfadad029b4243a0560c940ec1a7cd287422e5c6b21c323387a6f6f45	BugBounty Tester Registration\n\nWallet:\n0x2546BcD3c84621e976D8185a91A922aE77ECEc30\n\nUsername:\nwhiteHacker\n\nEmail:\njumanamuntaha989@gmail.com\n\nPayload Hash:\n0x1656161bfadad029b4243a0560c940ec1a7cd287422e5c6b21c323387a6f6f45\n\nChallenge ID:\n25ae18a9-3574-4612-90a7-35109c3b0a92	2026-08-23 01:37:58.425445+06	2026-08-23 01:28:03.02261+06	2026-08-23 01:27:58.425445+06
9f729466-304d-4a19-8eac-410a4eaba8ae	0x2546bcd3c84621e976d8185a91a922ae77ecec30	0x4bce298450582180b7545cbde7099f630c838b6a09ac48858e84223509d59ca1	BugBounty Tester Registration\n\nWallet:\n0x2546BcD3c84621e976D8185a91A922aE77ECEc30\n\nUsername:\nwhiteHacker\n\nEmail:\nmuntahajumana@gmail.com\n\nPayload Hash:\n0x4bce298450582180b7545cbde7099f630c838b6a09ac48858e84223509d59ca1\n\nChallenge ID:\n9f729466-304d-4a19-8eac-410a4eaba8ae	2026-08-24 21:42:34.900367+06	\N	2026-08-24 21:32:34.900367+06
9be4d3f4-ab7a-42e2-8eab-b52126736bd0	0x2546bcd3c84621e976d8185a91a922ae77ecec30	0x4bce298450582180b7545cbde7099f630c838b6a09ac48858e84223509d59ca1	BugBounty Tester Registration\n\nWallet:\n0x2546BcD3c84621e976D8185a91A922aE77ECEc30\n\nUsername:\nwhiteHacker\n\nEmail:\nmuntahajumana@gmail.com\n\nPayload Hash:\n0x4bce298450582180b7545cbde7099f630c838b6a09ac48858e84223509d59ca1\n\nChallenge ID:\n9be4d3f4-ab7a-42e2-8eab-b52126736bd0	2026-08-25 00:53:34.558142+06	\N	2026-08-25 00:43:34.558142+06
\.


--
-- Data for Name: vulnerability_reports; Type: TABLE DATA; Schema: public; Owner: jumana_bountyapp
--

COPY public.vulnerability_reports (id, bounty_db_id, tester_id, tester_wallet, title, severity, description, steps_to_reproduce, evidence_url, report_hash, status, approved_reward_wei, payout_nonce, payout_deadline, company_signature, reviewed_at, claimed_at, claim_transaction_hash, created_at, updated_at) FROM stdin;
1	1	12	0x2546BcD3c84621e976D8185a91A922aE77ECEc30	The first report submission	Medium	this is the first report	jni nah	https://www.michaelhorowitz.com/linksthatlie.php	0x59b6b5b22bf0daa05895cb500d5dec3a48bd5387391c94e723395414324b8c2b	accepted	\N	\N	\N	\N	\N	\N	\N	2026-09-01 11:32:30.190465+06	2026-09-01 13:10:21.928548+06
\.


--
-- Name: authorization_issuances_id_seq; Type: SEQUENCE SET; Schema: public; Owner: jumana_bountyapp
--

SELECT pg_catalog.setval('public.authorization_issuances_id_seq', 5, true);


--
-- Name: blockchain_events_id_seq; Type: SEQUENCE SET; Schema: public; Owner: jumana_bountyapp
--

SELECT pg_catalog.setval('public.blockchain_events_id_seq', 2, true);


--
-- Name: bounties_id_seq; Type: SEQUENCE SET; Schema: public; Owner: jumana_bountyapp
--

SELECT pg_catalog.setval('public.bounties_id_seq', 1, true);


--
-- Name: bounty_metadata_id_seq; Type: SEQUENCE SET; Schema: public; Owner: jumana_bountyapp
--

SELECT pg_catalog.setval('public.bounty_metadata_id_seq', 1, true);


--
-- Name: participants_id_seq; Type: SEQUENCE SET; Schema: public; Owner: jumana_bountyapp
--

SELECT pg_catalog.setval('public.participants_id_seq', 2, true);


--
-- Name: participants_id_seq1; Type: SEQUENCE SET; Schema: public; Owner: jumana_bountyapp
--

SELECT pg_catalog.setval('public.participants_id_seq1', 12, true);


--
-- Name: submissions_id_seq; Type: SEQUENCE SET; Schema: public; Owner: jumana_bountyapp
--

SELECT pg_catalog.setval('public.submissions_id_seq', 1, false);


--
-- Name: vulnerability_reports_id_seq; Type: SEQUENCE SET; Schema: public; Owner: jumana_bountyapp
--

SELECT pg_catalog.setval('public.vulnerability_reports_id_seq', 1, true);


--
-- Name: authorization_issuances authorization_issuances_authorization_digest_key; Type: CONSTRAINT; Schema: public; Owner: jumana_bountyapp
--

ALTER TABLE ONLY public.authorization_issuances
    ADD CONSTRAINT authorization_issuances_authorization_digest_key UNIQUE (authorization_digest);


--
-- Name: authorization_issuances authorization_issuances_pkey; Type: CONSTRAINT; Schema: public; Owner: jumana_bountyapp
--

ALTER TABLE ONLY public.authorization_issuances
    ADD CONSTRAINT authorization_issuances_pkey PRIMARY KEY (id);


--
-- Name: blockchain_events blockchain_events_chain_id_transaction_hash_log_index_key; Type: CONSTRAINT; Schema: public; Owner: jumana_bountyapp
--

ALTER TABLE ONLY public.blockchain_events
    ADD CONSTRAINT blockchain_events_chain_id_transaction_hash_log_index_key UNIQUE (chain_id, transaction_hash, log_index);


--
-- Name: blockchain_events blockchain_events_pkey; Type: CONSTRAINT; Schema: public; Owner: jumana_bountyapp
--

ALTER TABLE ONLY public.blockchain_events
    ADD CONSTRAINT blockchain_events_pkey PRIMARY KEY (id);


--
-- Name: bounties bounties_chain_id_escrow_address_bounty_id_key; Type: CONSTRAINT; Schema: public; Owner: jumana_bountyapp
--

ALTER TABLE ONLY public.bounties
    ADD CONSTRAINT bounties_chain_id_escrow_address_bounty_id_key UNIQUE (chain_id, escrow_address, bounty_id);


--
-- Name: bounties bounties_pkey; Type: CONSTRAINT; Schema: public; Owner: jumana_bountyapp
--

ALTER TABLE ONLY public.bounties
    ADD CONSTRAINT bounties_pkey PRIMARY KEY (id);


--
-- Name: bounty_metadata bounty_metadata_pkey; Type: CONSTRAINT; Schema: public; Owner: jumana_bountyapp
--

ALTER TABLE ONLY public.bounty_metadata
    ADD CONSTRAINT bounty_metadata_pkey PRIMARY KEY (id);


--
-- Name: company_registration_challenges company_registration_challenges_pkey; Type: CONSTRAINT; Schema: public; Owner: jumana_bountyapp
--

ALTER TABLE ONLY public.company_registration_challenges
    ADD CONSTRAINT company_registration_challenges_pkey PRIMARY KEY (id);


--
-- Name: login_challenges login_challenges_pkey; Type: CONSTRAINT; Schema: public; Owner: jumana_bountyapp
--

ALTER TABLE ONLY public.login_challenges
    ADD CONSTRAINT login_challenges_pkey PRIMARY KEY (id);


--
-- Name: participants_onchain_legacy participants_pkey; Type: CONSTRAINT; Schema: public; Owner: jumana_bountyapp
--

ALTER TABLE ONLY public.participants_onchain_legacy
    ADD CONSTRAINT participants_pkey PRIMARY KEY (id);


--
-- Name: participants participants_pkey1; Type: CONSTRAINT; Schema: public; Owner: jumana_bountyapp
--

ALTER TABLE ONLY public.participants
    ADD CONSTRAINT participants_pkey1 PRIMARY KEY (id);


--
-- Name: submissions submissions_chain_id_escrow_address_submission_id_key; Type: CONSTRAINT; Schema: public; Owner: jumana_bountyapp
--

ALTER TABLE ONLY public.submissions
    ADD CONSTRAINT submissions_chain_id_escrow_address_submission_id_key UNIQUE (chain_id, escrow_address, submission_id);


--
-- Name: submissions submissions_pkey; Type: CONSTRAINT; Schema: public; Owner: jumana_bountyapp
--

ALTER TABLE ONLY public.submissions
    ADD CONSTRAINT submissions_pkey PRIMARY KEY (id);


--
-- Name: tester_registration_challenges tester_registration_challenges_pkey; Type: CONSTRAINT; Schema: public; Owner: jumana_bountyapp
--

ALTER TABLE ONLY public.tester_registration_challenges
    ADD CONSTRAINT tester_registration_challenges_pkey PRIMARY KEY (id);


--
-- Name: vulnerability_reports vulnerability_reports_bounty_db_id_report_hash_key; Type: CONSTRAINT; Schema: public; Owner: jumana_bountyapp
--

ALTER TABLE ONLY public.vulnerability_reports
    ADD CONSTRAINT vulnerability_reports_bounty_db_id_report_hash_key UNIQUE (bounty_db_id, report_hash);


--
-- Name: vulnerability_reports vulnerability_reports_pkey; Type: CONSTRAINT; Schema: public; Owner: jumana_bountyapp
--

ALTER TABLE ONLY public.vulnerability_reports
    ADD CONSTRAINT vulnerability_reports_pkey PRIMARY KEY (id);


--
-- Name: authorization_status_deadline_index; Type: INDEX; Schema: public; Owner: jumana_bountyapp
--

CREATE INDEX authorization_status_deadline_index ON public.authorization_issuances USING btree (status, deadline);


--
-- Name: authorization_wallet_nonce_index; Type: INDEX; Schema: public; Owner: jumana_bountyapp
--

CREATE INDEX authorization_wallet_nonce_index ON public.authorization_issuances USING btree (lower((wallet_address)::text), nonce);


--
-- Name: blockchain_events_block_index; Type: INDEX; Schema: public; Owner: jumana_bountyapp
--

CREATE INDEX blockchain_events_block_index ON public.blockchain_events USING btree (block_number);


--
-- Name: bounties_company_index; Type: INDEX; Schema: public; Owner: jumana_bountyapp
--

CREATE INDEX bounties_company_index ON public.bounties USING btree (lower((company_address)::text));


--
-- Name: bounties_status_index; Type: INDEX; Schema: public; Owner: jumana_bountyapp
--

CREATE INDEX bounties_status_index ON public.bounties USING btree (status);


--
-- Name: company_registration_challenges_status_index; Type: INDEX; Schema: public; Owner: jumana_bountyapp
--

CREATE INDEX company_registration_challenges_status_index ON public.company_registration_challenges USING btree (expires_at, used_at);


--
-- Name: company_registration_challenges_wallet_index; Type: INDEX; Schema: public; Owner: jumana_bountyapp
--

CREATE INDEX company_registration_challenges_wallet_index ON public.company_registration_challenges USING btree (lower((wallet_address)::text));


--
-- Name: login_challenges_active_index; Type: INDEX; Schema: public; Owner: jumana_bountyapp
--

CREATE INDEX login_challenges_active_index ON public.login_challenges USING btree (expires_at, used_at);


--
-- Name: login_challenges_wallet_index; Type: INDEX; Schema: public; Owner: jumana_bountyapp
--

CREATE INDEX login_challenges_wallet_index ON public.login_challenges USING btree (lower((wallet_address)::text));


--
-- Name: participants_role_status_index; Type: INDEX; Schema: public; Owner: jumana_bountyapp
--

CREATE INDEX participants_role_status_index ON public.participants USING btree (participant_type, active, verified);


--
-- Name: participants_unique_email; Type: INDEX; Schema: public; Owner: jumana_bountyapp
--

CREATE UNIQUE INDEX participants_unique_email ON public.participants USING btree (lower((email)::text)) WHERE (email IS NOT NULL);


--
-- Name: participants_unique_tester_username; Type: INDEX; Schema: public; Owner: jumana_bountyapp
--

CREATE UNIQUE INDEX participants_unique_tester_username ON public.participants USING btree (lower((username)::text)) WHERE ((participant_type = 2) AND (username IS NOT NULL));


--
-- Name: participants_unique_wallet; Type: INDEX; Schema: public; Owner: jumana_bountyapp
--

CREATE UNIQUE INDEX participants_unique_wallet ON public.participants_onchain_legacy USING btree (chain_id, lower((registry_address)::text), lower((wallet_address)::text));


--
-- Name: submissions_bounty_index; Type: INDEX; Schema: public; Owner: jumana_bountyapp
--

CREATE INDEX submissions_bounty_index ON public.submissions USING btree (bounty_id);


--
-- Name: submissions_status_index; Type: INDEX; Schema: public; Owner: jumana_bountyapp
--

CREATE INDEX submissions_status_index ON public.submissions USING btree (status);


--
-- Name: submissions_tester_index; Type: INDEX; Schema: public; Owner: jumana_bountyapp
--

CREATE INDEX submissions_tester_index ON public.submissions USING btree (lower((tester_address)::text));


--
-- Name: tester_registration_challenges_status_index; Type: INDEX; Schema: public; Owner: jumana_bountyapp
--

CREATE INDEX tester_registration_challenges_status_index ON public.tester_registration_challenges USING btree (expires_at, used_at);


--
-- Name: tester_registration_challenges_wallet_index; Type: INDEX; Schema: public; Owner: jumana_bountyapp
--

CREATE INDEX tester_registration_challenges_wallet_index ON public.tester_registration_challenges USING btree (lower((wallet_address)::text));


--
-- Name: vulnerability_reports_bounty_index; Type: INDEX; Schema: public; Owner: jumana_bountyapp
--

CREATE INDEX vulnerability_reports_bounty_index ON public.vulnerability_reports USING btree (bounty_db_id, status);


--
-- Name: vulnerability_reports_tester_index; Type: INDEX; Schema: public; Owner: jumana_bountyapp
--

CREATE INDEX vulnerability_reports_tester_index ON public.vulnerability_reports USING btree (tester_id, status);


--
-- Name: bounty_metadata bounty_metadata_bounty_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: jumana_bountyapp
--

ALTER TABLE ONLY public.bounty_metadata
    ADD CONSTRAINT bounty_metadata_bounty_id_fkey FOREIGN KEY (bounty_id) REFERENCES public.bounties(id) ON DELETE CASCADE;


--
-- Name: login_challenges login_challenges_participant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: jumana_bountyapp
--

ALTER TABLE ONLY public.login_challenges
    ADD CONSTRAINT login_challenges_participant_id_fkey FOREIGN KEY (participant_id) REFERENCES public.participants(id) ON DELETE CASCADE;


--
-- Name: vulnerability_reports vulnerability_reports_bounty_db_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: jumana_bountyapp
--

ALTER TABLE ONLY public.vulnerability_reports
    ADD CONSTRAINT vulnerability_reports_bounty_db_id_fkey FOREIGN KEY (bounty_db_id) REFERENCES public.bounties(id) ON DELETE CASCADE;


--
-- Name: vulnerability_reports vulnerability_reports_tester_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: jumana_bountyapp
--

ALTER TABLE ONLY public.vulnerability_reports
    ADD CONSTRAINT vulnerability_reports_tester_id_fkey FOREIGN KEY (tester_id) REFERENCES public.participants(id) ON DELETE CASCADE;


--
-- PostgreSQL database dump complete
--

\unrestrict Ak0e89kP2UAehfI2qcWQNQirrKalFvKu2RZCT9pHADoOdGkkjPvaRxOYube9CfP

