begin;

grant insert, update
on table public.journal_entries
to authenticated;

grant insert, update
on table public.journal_lines
to authenticated;

commit;