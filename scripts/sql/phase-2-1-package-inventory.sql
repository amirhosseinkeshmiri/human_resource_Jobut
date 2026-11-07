-- READ ONLY: run before migration/seed and save the result for reconciliation.
select id, name, job_credits, price_toman, is_active, created_at, updated_at
from job_packages
order by name, created_at, id;

select name, count(*) as records
from job_packages
where name in ('تک آگهی - آزاد', 'سه ماهه', 'شش ماهه', 'یک ساله', 'یک ساله نامحدود')
group by name
having count(*) > 1
order by name;
