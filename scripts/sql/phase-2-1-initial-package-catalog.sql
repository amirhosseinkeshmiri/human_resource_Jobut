-- DATA SEED (run only after drizzle/0027_public_package_catalog.sql).
-- Idempotent and fail-closed: it never changes an existing name, price, or credit count.
-- A same-name/different-value or duplicate exact match aborts the whole transaction.
begin;

create temporary table desired_jobut_packages (
  id uuid primary key,
  name varchar(120) not null,
  job_credits integer not null,
  price_toman integer not null,
  display_order integer not null,
  display_validity_text varchar(120),
  payment_description varchar(240),
  online_checkout_enabled boolean not null
) on commit drop;

insert into desired_jobut_packages values
('21000000-0000-4000-8000-000000000001', 'تک آگهی - آزاد', 1, 399000, 10, '۷ روز (صرفاً توضیح بازاریابی؛ مدت نمایش هر آگهی مستقل است)', 'نقد ابتدای دوره', true),
('21000000-0000-4000-8000-000000000002', 'سه ماهه', 6, 2100000, 20, '۹۰ روز (صرفاً توضیح بازاریابی؛ مدت نمایش هر آگهی مستقل است)', 'نقد ابتدای دوره', true),
('21000000-0000-4000-8000-000000000003', 'شش ماهه', 15, 4500000, 30, '۱۸۰ روز (صرفاً توضیح بازاریابی؛ مدت نمایش هر آگهی مستقل است)', 'نقد ابتدای دوره', true),
('21000000-0000-4000-8000-000000000004', 'یک ساله', 35, 8750000, 40, '۳۶۵ روز (صرفاً توضیح بازاریابی؛ مدت نمایش هر آگهی مستقل است)', 'نقد ابتدای دوره', true),
('21000000-0000-4000-8000-000000000005', 'یک ساله نامحدود', 350, 70000000, 50, '۳۶۵ روز + ۳ ماه (صرفاً توضیح بازاریابی؛ مدت نمایش هر آگهی مستقل است)', 'روش بازاریابی تاریخی: سه قسط ۳۰، ۲۰ و ۲۰ میلیون تومان؛ پرداخت اقساطی فعلاً آنلاین فعال نیست.', false);

do $$
declare
  desired record;
  matched_id uuid;
  exact_count integer;
  same_name_count integer;
  id_identity_matches boolean;
begin
  for desired in select * from desired_jobut_packages order by display_order loop
    select count(*)::integer, (array_agg(id order by id))[1]
      into exact_count, matched_id
    from job_packages
    where name = desired.name
      and job_credits = desired.job_credits
      and price_toman = desired.price_toman;

    select count(*)::integer into same_name_count
    from job_packages where name = desired.name;

    select exists(
      select 1 from job_packages
      where id = desired.id
        and name = desired.name
        and job_credits = desired.job_credits
        and price_toman = desired.price_toman
    ) into id_identity_matches;

    if exists(select 1 from job_packages where id = desired.id) and not id_identity_matches then
      raise exception 'Seed UUID % is already used by a different package', desired.id;
    elsif exact_count > 1 then
      raise exception 'Multiple exact package matches for %, reconcile manually', desired.name;
    elsif exact_count = 0 and same_name_count > 0 then
      raise exception 'Same-name package has different price/credits for %, reconcile manually', desired.name;
    elsif exact_count = 0 then
      insert into job_packages (
        id, name, job_credits, price_toman, is_active, display_order,
        display_validity_text, payment_description, online_checkout_enabled
      ) values (
        desired.id, desired.name, desired.job_credits, desired.price_toman, true,
        desired.display_order, desired.display_validity_text,
        desired.payment_description, desired.online_checkout_enabled
      );
    else
      update job_packages set
        is_active = true,
        display_order = desired.display_order,
        display_validity_text = desired.display_validity_text,
        payment_description = desired.payment_description,
        online_checkout_enabled = desired.online_checkout_enabled,
        updated_at = now()
      where id = matched_id;
    end if;
  end loop;
end $$;

commit;

-- POST-SEED VERIFICATION (read only)
select id, name, job_credits, price_toman, is_active, display_order,
       display_validity_text, payment_description, online_checkout_enabled
from job_packages
where name in ('تک آگهی - آزاد', 'سه ماهه', 'شش ماهه', 'یک ساله', 'یک ساله نامحدود')
order by display_order nulls last, price_toman, id;
