-- Git Branch Matrix: the ONLY place this app ever writes.
-- Git is read strictly read-only; every mutation lands here.

create table if not exists repo (
  id             serial primary key,
  name           text not null unique,
  path           text not null,
  envs           text[] not null default '{development,staging,release,main}',
  remote         text not null default 'origin',
  ticket_pattern text not null default '[A-Z][A-Z0-9]{1,9}-\d+',
  scan_limit     integer not null default 500,
  -- A ticket counts as done once it lands in ALL of these, not in every env.
  -- Intersected with `envs` at read time, so a repo without `release` still works.
  done_envs      text[] not null default '{release,main}',
  sort_order     integer not null default 0,
  archived       boolean not null default false,
  created_at     timestamptz not null default now()
);

-- Manual metadata git cannot know: why branches were combined, QA status,
-- and ticket IDs that never made it into a branch name.
create table if not exists branch_note (
  id         serial primary key,
  repo_id    integer not null references repo(id) on delete cascade,
  branch     text not null,
  tickets    text[] not null default '{}',
  note       text,
  status     text,
  updated_at timestamptz not null default now(),
  unique (repo_id, branch)
);

create index if not exists branch_note_repo_idx on branch_note (repo_id);

create or replace function touch_updated_at() returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists branch_note_touch on branch_note;
create trigger branch_note_touch before update on branch_note
  for each row execute function touch_updated_at();

-- migration for databases created before done_envs existed
alter table repo add column if not exists done_envs text[] not null default '{release,main}';
