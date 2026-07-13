-- Enable the pgvector extension to work with embeddings
create extension if not exists vector;

-- Create a table for the watchlist
create table public.watchlist (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  embedding vector(512), -- InsightFace buffalo_l models produce 512-dimensional embeddings
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Create a table for alerts
create table public.alerts (
  id uuid primary key default gen_random_uuid(),
  person_id text not null,
  type text not null,
  message text not null,
  severity text not null,
  timestamp timestamp with time zone default timezone('utc'::text, now()) not null,
  details jsonb
);

-- Create a table for analytics
create table public.analytics (
  id uuid primary key default gen_random_uuid(),
  timestamp timestamp with time zone default timezone('utc'::text, now()) not null,
  emotion_distribution jsonb,
  active_threats integer
);

-- Create a function to match faces (vector similarity search)
create or replace function match_faces (
  query_embedding vector(512),
  match_threshold float,
  match_count int
)
returns table (
  id uuid,
  name text,
  similarity float
)
language sql stable
as $$
  select
    id,
    name,
    1 - (embedding <=> query_embedding) as similarity
  from public.watchlist
  where 1 - (embedding <=> query_embedding) > match_threshold
  order by similarity desc
  limit match_count;
$$;
