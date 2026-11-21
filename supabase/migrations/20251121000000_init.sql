create extension if not exists pgcrypto;

create type public.user_role as enum ('entrepreneur', 'customer');
create type public.business_status as enum ('active', 'paused', 'archived');
create type public.product_status as enum ('draft', 'published', 'archived');
create type public.order_status as enum ('pending', 'awaiting_payment', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled', 'expired');
create type public.live_status as enum ('scheduled', 'live', 'ended');
create type public.reservation_status as enum ('active', 'consumed', 'released', 'expired');
create type public.message_role as enum ('customer', 'assistant', 'entrepreneur');
create type public.conversation_channel as enum ('store', 'live', 'assistant');

create table public.profiles (
  id uuid primary key default gen_random_uuid(),
  clerk_user_id text unique,
  email text not null,
  full_name text not null,
  role public.user_role not null default 'customer',
  created_at timestamptz not null default now()
);

create table public.businesses (
  id uuid primary key default gen_random_uuid(),
  owner_profile_id uuid not null references public.profiles(id) on delete cascade,
  name text not null,
  slug text not null unique,
  description text not null default '',
  category text not null default '',
  logo_url text,
  cover_url text,
  contact_email text,
  contact_phone text,
  status public.business_status not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index businesses_slug_idx on public.businesses(slug);
create index businesses_owner_idx on public.businesses(owner_profile_id);

create table public.business_members (
  business_id uuid not null references public.businesses(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  role text not null default 'owner',
  created_at timestamptz not null default now(),
  primary key (business_id, profile_id)
);

create table public.products (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  name text not null,
  slug text not null,
  description text not null default '',
  category text not null default '',
  tags text[] not null default '{}',
  price numeric(12,2) not null check (price >= 0),
  currency text not null default 'BOB',
  status public.product_status not null default 'draft',
  featured boolean not null default false,
  ai_generated boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (business_id, slug)
);
create index products_business_status_idx on public.products(business_id, status);
create index products_category_idx on public.products(category);

create table public.product_images (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  storage_path text not null,
  url text not null,
  alt text,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);
create index product_images_product_idx on public.product_images(product_id, sort_order);

create table public.product_variants (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  name text not null,
  sku text,
  price_override numeric(12,2) check (price_override is null or price_override >= 0),
  created_at timestamptz not null default now()
);
create index product_variants_product_idx on public.product_variants(product_id);

create table public.inventory (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete cascade,
  quantity integer not null default 0 check (quantity >= 0),
  reserved_quantity integer not null default 0 check (reserved_quantity >= 0),
  low_stock_threshold integer not null default 3 check (low_stock_threshold >= 0),
  updated_at timestamptz not null default now(),
  unique (product_id)
);
create index inventory_business_idx on public.inventory(business_id);

create table public.inventory_movements (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete cascade,
  delta integer not null,
  reason text not null,
  reference_type text,
  reference_id uuid,
  created_at timestamptz not null default now()
);
create index inventory_movements_product_idx on public.inventory_movements(product_id, created_at desc);

create table public.inventory_reservations (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete cascade,
  order_id uuid,
  quantity integer not null check (quantity > 0),
  status public.reservation_status not null default 'active',
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);
create index inventory_reservations_order_idx on public.inventory_reservations(order_id);
create index inventory_reservations_expiry_idx on public.inventory_reservations(status, expires_at);

create table public.customers (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  name text not null,
  email text,
  phone text,
  clerk_user_id text,
  created_at timestamptz not null default now(),
  unique (business_id, email)
);
create index customers_business_idx on public.customers(business_id);

create table public.orders (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  customer_id uuid references public.customers(id) on delete set null,
  status public.order_status not null default 'pending',
  subtotal numeric(12,2) not null default 0,
  total numeric(12,2) not null default 0,
  currency text not null default 'BOB',
  idempotency_key text not null,
  shipping_address jsonb,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  confirmed_at timestamptz,
  paid_at timestamptz,
  unique (business_id, idempotency_key)
);
create index orders_business_created_idx on public.orders(business_id, created_at desc);
create index orders_customer_idx on public.orders(customer_id);

create table public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete restrict,
  product_name text not null,
  unit_price numeric(12,2) not null,
  quantity integer not null check (quantity > 0)
);
create index order_items_order_idx on public.order_items(order_id);

create table public.live_sessions (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  title text not null,
  description text,
  status public.live_status not null default 'scheduled',
  featured_product_ids uuid[] not null default '{}',
  started_at timestamptz,
  ended_at timestamptz,
  created_at timestamptz not null default now()
);
create index live_sessions_business_idx on public.live_sessions(business_id, created_at desc);

create table public.live_comments (
  id uuid primary key default gen_random_uuid(),
  live_session_id uuid not null references public.live_sessions(id) on delete cascade,
  customer_name text not null,
  message text not null,
  product_id uuid references public.products(id) on delete set null,
  created_at timestamptz not null default now()
);
create index live_comments_session_idx on public.live_comments(live_session_id, created_at);

create table public.conversations (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  customer_id uuid references public.customers(id) on delete set null,
  channel public.conversation_channel not null default 'assistant',
  status text not null default 'open' check (status in ('open', 'closed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index conversations_business_idx on public.conversations(business_id, updated_at desc);

create table public.messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  role public.message_role not null,
  content text not null,
  product_id uuid references public.products(id) on delete set null,
  metadata jsonb not null default '{}',
  created_at timestamptz not null default now()
);
create index messages_conversation_idx on public.messages(conversation_id, created_at);

create table public.sales_insights (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  type text not null,
  payload jsonb not null default '{}',
  period_start timestamptz not null,
  period_end timestamptz not null,
  created_at timestamptz not null default now()
);
create index sales_insights_business_idx on public.sales_insights(business_id, created_at desc);

create table public.automation_logs (
  id uuid primary key default gen_random_uuid(),
  business_id uuid references public.businesses(id) on delete cascade,
  workflow text not null,
  event text not null,
  status text not null check (status in ('success', 'failed', 'skipped')),
  payload jsonb not null default '{}',
  created_at timestamptz not null default now()
);
create index automation_logs_business_idx on public.automation_logs(business_id, created_at desc);

create table public.notification_preferences (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  channel text not null,
  enabled boolean not null default true,
  config jsonb not null default '{}',
  updated_at timestamptz not null default now(),
  unique (business_id, channel)
);

create or replace function public.is_business_member(p_business_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.business_members bm
    where bm.business_id = p_business_id
      and bm.profile_id = auth.uid()
  );
$$;

create or replace function public.is_business_owner(p_business_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.businesses b
    where b.id = p_business_id
      and b.owner_profile_id = auth.uid()
  );
$$;

alter table public.profiles enable row level security;
alter table public.businesses enable row level security;
alter table public.business_members enable row level security;
alter table public.products enable row level security;
alter table public.product_images enable row level security;
alter table public.product_variants enable row level security;
alter table public.inventory enable row level security;
alter table public.inventory_movements enable row level security;
alter table public.inventory_reservations enable row level security;
alter table public.customers enable row level security;
alter table public.orders enable row level security;
alter table public.order_items enable row level security;
alter table public.live_sessions enable row level security;
alter table public.live_comments enable row level security;
alter table public.conversations enable row level security;
alter table public.messages enable row level security;
alter table public.sales_insights enable row level security;
alter table public.automation_logs enable row level security;
alter table public.notification_preferences enable row level security;

create policy profiles_select_own on public.profiles
  for select using (id = auth.uid() or clerk_user_id = auth.jwt() ->> 'sub');
create policy profiles_insert_own on public.profiles
  for insert with check (id = auth.uid() or clerk_user_id = auth.jwt() ->> 'sub');
create policy profiles_update_own on public.profiles
  for update using (id = auth.uid() or clerk_user_id = auth.jwt() ->> 'sub');

create policy businesses_public_read on public.businesses
  for select using (status = 'active');
create policy businesses_member_read on public.businesses
  for select using (public.is_business_member(id));
create policy businesses_owner_insert on public.businesses
  for insert with check (owner_profile_id = auth.uid());
create policy businesses_owner_update on public.businesses
  for update using (owner_profile_id = auth.uid());
create policy businesses_owner_delete on public.businesses
  for delete using (owner_profile_id = auth.uid());

create policy business_members_member_read on public.business_members
  for select using (profile_id = auth.uid() or public.is_business_member(business_id));
create policy business_members_owner_manage on public.business_members
  for all using (public.is_business_owner(business_id)) with check (public.is_business_owner(business_id));

create policy products_public_read on public.products
  for select using (status = 'published' and exists (select 1 from public.businesses b where b.id = products.business_id and b.status = 'active'));
create policy products_member_all on public.products
  for all using (public.is_business_member(business_id)) with check (public.is_business_member(business_id));

create policy product_images_public_read on public.product_images
  for select using (exists (select 1 from public.products p where p.id = product_images.product_id and p.status = 'published'));
create policy product_images_member_all on public.product_images
  for all using (exists (select 1 from public.products p where p.id = product_images.product_id and public.is_business_member(p.business_id)))
  with check (exists (select 1 from public.products p where p.id = product_images.product_id and public.is_business_member(p.business_id)));

create policy product_variants_public_read on public.product_variants
  for select using (exists (select 1 from public.products p where p.id = product_variants.product_id and p.status = 'published'));
create policy product_variants_member_all on public.product_variants
  for all using (exists (select 1 from public.products p where p.id = product_variants.product_id and public.is_business_member(p.business_id)))
  with check (exists (select 1 from public.products p where p.id = product_variants.product_id and public.is_business_member(p.business_id)));

create policy inventory_member_all on public.inventory
  for all using (public.is_business_member(business_id)) with check (public.is_business_member(business_id));

create policy inventory_movements_member_read on public.inventory_movements
  for select using (public.is_business_member(business_id));
create policy inventory_movements_member_insert on public.inventory_movements
  for insert with check (public.is_business_member(business_id));

create policy inventory_reservations_member_all on public.inventory_reservations
  for all using (public.is_business_member(business_id)) with check (public.is_business_member(business_id));

create policy customers_public_insert on public.customers
  for insert with check (true);
create policy customers_member_all on public.customers
  for all using (public.is_business_member(business_id)) with check (public.is_business_member(business_id));

create policy orders_member_read on public.orders
  for select using (public.is_business_member(business_id));
create policy orders_customer_insert on public.orders
  for insert with check (public.is_business_member(business_id));
create policy orders_member_update on public.orders
  for update using (public.is_business_member(business_id));

create policy order_items_member_read on public.order_items
  for select using (exists (select 1 from public.orders o where o.id = order_items.order_id and public.is_business_member(o.business_id)));
create policy order_items_member_insert on public.order_items
  for insert with check (exists (select 1 from public.orders o where o.id = order_items.order_id and public.is_business_member(o.business_id)));

create policy live_sessions_public_read on public.live_sessions
  for select using (status in ('scheduled', 'live') and exists (select 1 from public.businesses b where b.id = live_sessions.business_id and b.status = 'active'));
create policy live_sessions_member_all on public.live_sessions
  for all using (public.is_business_member(business_id)) with check (public.is_business_member(business_id));

create policy live_comments_public_read on public.live_comments
  for select using (exists (select 1 from public.live_sessions l join public.businesses b on b.id = l.business_id where l.id = live_comments.live_session_id and b.status = 'active'));
create policy live_comments_public_insert on public.live_comments
  for insert with check (exists (select 1 from public.live_sessions l join public.businesses b on b.id = l.business_id where l.id = live_comments.live_session_id and b.status = 'active'));
create policy live_comments_member_delete on public.live_comments
  for delete using (exists (select 1 from public.live_sessions l where l.id = live_comments.live_session_id and public.is_business_member(l.business_id)));

create policy conversations_member_all on public.conversations
  for all using (public.is_business_member(business_id)) with check (public.is_business_member(business_id));

create policy messages_member_all on public.messages
  for all using (exists (select 1 from public.conversations c where c.id = messages.conversation_id and public.is_business_member(c.business_id)))
  with check (exists (select 1 from public.conversations c where c.id = messages.conversation_id and public.is_business_member(c.business_id)));

create policy sales_insights_member_all on public.sales_insights
  for all using (public.is_business_member(business_id)) with check (public.is_business_member(business_id));

create policy automation_logs_member_read on public.automation_logs
  for select using (business_id is null or public.is_business_member(business_id));
create policy automation_logs_member_insert on public.automation_logs
  for insert with check (business_id is null or public.is_business_member(business_id));

create policy notification_preferences_member_all on public.notification_preferences
  for all using (public.is_business_member(business_id)) with check (public.is_business_member(business_id));

create or replace function public.create_order(
  p_business_id uuid,
  p_customer jsonb,
  p_items jsonb,
  p_idempotency_key text,
  p_shipping_address jsonb default null,
  p_notes text default null
)
returns public.orders
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order public.orders;
  v_customer_id uuid;
  v_item jsonb;
  v_product public.products;
  v_inventory public.inventory;
  v_quantity integer;
  v_subtotal numeric(12,2) := 0;
  v_currency text := 'BOB';
  v_reservation_id uuid;
begin
  select * into v_order from public.orders where business_id = p_business_id and idempotency_key = p_idempotency_key;
  if found then
    return v_order;
  end if;

  if jsonb_array_length(p_items) = 0 then
    raise exception 'ORDER_EMPTY';
  end if;

  insert into public.customers (business_id, name, email, phone, clerk_user_id)
  values (
    p_business_id,
    coalesce(nullif(p_customer->>'name', ''), 'Cliente PICKAPP'),
    nullif(p_customer->>'email', ''),
    nullif(p_customer->>'phone', ''),
    nullif(p_customer->>'clerk_user_id', '')
  )
  on conflict (business_id, email) do update
    set name = excluded.name,
        phone = coalesce(excluded.phone, public.customers.phone),
        clerk_user_id = coalesce(excluded.clerk_user_id, public.customers.clerk_user_id)
  returning id into v_customer_id;

  insert into public.orders (business_id, customer_id, status, subtotal, total, currency, idempotency_key, shipping_address, notes)
  values (p_business_id, v_customer_id, 'pending', 0, 0, v_currency, p_idempotency_key, p_shipping_address, p_notes)
  returning * into v_order;

  for v_item in select * from jsonb_array_elements(p_items)
  loop
    v_quantity := (v_item->>'quantity')::integer;
    select * into v_product from public.products
      where id = (v_item->>'product_id')::uuid
        and business_id = p_business_id
        and status = 'published';
    if not found then
      raise exception 'PRODUCT_NOT_AVAILABLE';
    end if;

    select * into v_inventory from public.inventory
      where product_id = v_product.id
      for update;
    if not found or (v_inventory.quantity - v_inventory.reserved_quantity) < v_quantity then
      raise exception 'INSUFFICIENT_STOCK';
    end if;

    insert into public.order_items (order_id, product_id, product_name, unit_price, quantity)
    values (v_order.id, v_product.id, v_product.name, v_product.price, v_quantity);

    v_subtotal := v_subtotal + (v_product.price * v_quantity);
    v_currency := v_product.currency;

    insert into public.inventory_reservations (business_id, product_id, order_id, quantity, status, expires_at)
    values (p_business_id, v_product.id, v_order.id, v_quantity, 'active', now() + interval '15 minutes')
    returning id into v_reservation_id;

    update public.inventory
      set reserved_quantity = reserved_quantity + v_quantity,
          updated_at = now()
      where id = v_inventory.id;
  end loop;

  update public.orders
    set subtotal = v_subtotal,
        total = v_subtotal,
        currency = v_currency,
        updated_at = now()
    where id = v_order.id
    returning * into v_order;

  insert into public.automation_logs (business_id, workflow, event, status, payload)
  values (p_business_id, 'smart-order-manager', 'order.created', 'success', jsonb_build_object('order_id', v_order.id, 'idempotency_key', p_idempotency_key));

  return v_order;
end;
$$;

create or replace function public.adjust_inventory(
  p_business_id uuid,
  p_product_id uuid,
  p_delta integer,
  p_reason text default 'manual'
)
returns public.inventory
language plpgsql
security definer
set search_path = public
as $$
declare
  v_inventory public.inventory;
begin
  select * into v_inventory
    from public.inventory
    where product_id = p_product_id
      and business_id = p_business_id
    for update;
  if not found then
    raise exception 'INVENTORY_NOT_FOUND';
  end if;
  if v_inventory.quantity + p_delta < v_inventory.reserved_quantity then
    raise exception 'INSUFFICIENT_STOCK';
  end if;

  update public.inventory
    set quantity = quantity + p_delta,
        updated_at = now()
    where id = v_inventory.id
    returning * into v_inventory;

  insert into public.inventory_movements (business_id, product_id, delta, reason, reference_type, reference_id)
  values (p_business_id, p_product_id, p_delta, p_reason, 'manual', null);

  return v_inventory;
end;
$$;

create or replace function public.transition_order(p_order_id uuid, p_status public.order_status)
returns public.orders
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order public.orders;
  v_reservation public.inventory_reservations;
  v_item record;
  v_allowed public.order_status[];
  v_reserved integer;
  v_should_restock boolean;
begin
  select * into v_order from public.orders where id = p_order_id for update;
  if not found then
    raise exception 'ORDER_NOT_FOUND';
  end if;

  v_allowed := case v_order.status
    when 'pending' then array['awaiting_payment', 'confirmed', 'cancelled', 'expired']::public.order_status[]
    when 'awaiting_payment' then array['confirmed', 'cancelled', 'expired']::public.order_status[]
    when 'confirmed' then array['processing', 'cancelled']::public.order_status[]
    when 'processing' then array['shipped', 'cancelled']::public.order_status[]
    when 'shipped' then array['delivered']::public.order_status[]
    else array[]::public.order_status[]
  end;
  if not (p_status = any(v_allowed)) then
    raise exception 'INVALID_ORDER_TRANSITION';
  end if;

  if p_status in ('confirmed', 'processing', 'shipped', 'delivered') then
    if v_order.status in ('pending', 'awaiting_payment') then
      for v_item in
        select product_id, sum(quantity)::integer as quantity
        from public.order_items
        where order_id = p_order_id
        group by product_id
      loop
        select coalesce(sum(quantity), 0)::integer into v_reserved
        from public.inventory_reservations
        where order_id = p_order_id
          and product_id = v_item.product_id
          and status = 'active'
          and expires_at > now();
        if v_reserved < v_item.quantity then
          raise exception 'RESERVATION_EXPIRED_OR_MISSING';
        end if;
      end loop;
    end if;

    for v_reservation in
      select * from public.inventory_reservations
      where order_id = p_order_id and status = 'active' and expires_at > now()
      for update
    loop
      update public.inventory
        set quantity = greatest(quantity - v_reservation.quantity, 0),
            reserved_quantity = greatest(reserved_quantity - v_reservation.quantity, 0),
            updated_at = now()
        where product_id = v_reservation.product_id;
      update public.inventory_reservations
        set status = 'consumed'
        where id = v_reservation.id;
      insert into public.inventory_movements (business_id, product_id, delta, reason, reference_type, reference_id)
      values (v_order.business_id, v_reservation.product_id, -v_reservation.quantity, 'order_' || p_status::text, 'order', p_order_id);
    end loop;
  elsif p_status in ('cancelled', 'expired') then
    v_should_restock := v_order.status in ('confirmed', 'processing');
    for v_reservation in
      select * from public.inventory_reservations
      where order_id = p_order_id and status in ('active', 'consumed')
      for update
    loop
      if v_reservation.status = 'active' then
        update public.inventory
          set reserved_quantity = greatest(reserved_quantity - v_reservation.quantity, 0),
              updated_at = now()
          where product_id = v_reservation.product_id;
      elsif v_should_restock then
        update public.inventory
          set quantity = quantity + v_reservation.quantity,
              updated_at = now()
          where product_id = v_reservation.product_id;
        insert into public.inventory_movements (business_id, product_id, delta, reason, reference_type, reference_id)
        values (v_order.business_id, v_reservation.product_id, v_reservation.quantity, 'order_' || p_status::text || '_restock', 'order', p_order_id);
      end if;
      update public.inventory_reservations
        set status = case when p_status = 'expired' then 'expired' else 'released' end::public.reservation_status
        where id = v_reservation.id;
    end loop;
  end if;

  update public.orders
    set status = p_status,
        updated_at = now(),
        confirmed_at = case when p_status in ('confirmed', 'processing', 'shipped', 'delivered') then coalesce(confirmed_at, now()) else confirmed_at end,
        paid_at = case when p_status in ('confirmed', 'processing', 'shipped', 'delivered') then coalesce(paid_at, now()) else paid_at end
    where id = p_order_id
    returning * into v_order;

  insert into public.automation_logs (business_id, workflow, event, status, payload)
  values (v_order.business_id, 'smart-order-manager', 'order.status_changed', 'success', jsonb_build_object('order_id', p_order_id, 'status', p_status));

  return v_order;
end;
$$;

create or replace function public.release_expired_reservations()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count integer := 0;
  v_reservation record;
  v_order_id uuid;
  v_order_status public.order_status;
begin
  for v_reservation in
    select * from public.inventory_reservations
    where status = 'active' and expires_at < now()
    for update
  loop
    update public.inventory
      set reserved_quantity = greatest(reserved_quantity - v_reservation.quantity, 0),
          updated_at = now()
      where product_id = v_reservation.product_id;
    update public.inventory_reservations
      set status = 'expired'
      where id = v_reservation.id;
    v_count := v_count + 1;
  end loop;

  for v_order_id in
    select distinct order_id
    from public.inventory_reservations
    where status = 'expired'
      and expires_at < now()
      and order_id is not null
  loop
    select status into v_order_status
      from public.orders
      where id = v_order_id
      for update;
    if v_order_status in ('pending', 'awaiting_payment') then
      for v_reservation in
        select * from public.inventory_reservations
        where order_id = v_order_id and status = 'active'
        for update
      loop
        update public.inventory
          set reserved_quantity = greatest(reserved_quantity - v_reservation.quantity, 0),
              updated_at = now()
          where product_id = v_reservation.product_id;
        update public.inventory_reservations
          set status = 'expired'
          where id = v_reservation.id;
      end loop;
      update public.orders
        set status = 'expired', updated_at = now()
        where id = v_order_id;
    end if;
  end loop;

  return v_count;
end;
$$;

revoke all on function public.create_order(uuid, jsonb, jsonb, text, jsonb, text) from public, anon, authenticated;
revoke all on function public.transition_order(uuid, public.order_status) from public, anon, authenticated;
revoke all on function public.release_expired_reservations() from public, anon, authenticated;
revoke all on function public.adjust_inventory(uuid, uuid, integer, text) from public, anon, authenticated;

grant execute on function public.create_order(uuid, jsonb, jsonb, text, jsonb, text) to service_role;
grant execute on function public.transition_order(uuid, public.order_status) to service_role;
grant execute on function public.release_expired_reservations() to service_role;
grant execute on function public.adjust_inventory(uuid, uuid, integer, text) to service_role;
