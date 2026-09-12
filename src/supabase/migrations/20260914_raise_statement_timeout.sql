-- new migration, e.g. 20260914_raise_statement_timeout.sql
alter role authenticated set statement_timeout = '8000';
alter role anon set statement_timeout = '8000';