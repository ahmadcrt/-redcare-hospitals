-- REDCARE HOSPITALS - FICTIONAL SAMPLE DATA ONLY (run AFTER security.sql)
-- Designed & Developed by Ahmad
-- Every doctor below is an invented example (is_demo = true). No real people or patient records.

insert into public.departments (name, slug, description, services) values
('General Medicine','general-medicine','Primary care for adults, including check-ups and management of common conditions.','{"Adult consultations","Health screening","Chronic condition follow-up"}'),
('Cardiology','cardiology','Demonstration heart-care department covering assessment and ongoing cardiac care.','{"ECG","Blood pressure clinic","Cardiac risk assessment"}'),
('Pediatrics','pediatrics','Child health services from infancy through adolescence.','{"Child wellness visits","Immunization counselling","Growth monitoring"}'),
('Obstetrics and Gynecology','obstetrics-gynecology','Women''s health, antenatal and postnatal care.','{"Antenatal clinic","Postnatal care","Women''s health consultations"}'),
('Surgery','surgery','General surgical consultation and day-case procedures (demonstration).','{"Surgical consultation","Minor procedures","Pre-operative assessment"}'),
('Orthopedics','orthopedics','Bone, joint and muscle care.','{"Fracture clinic","Joint pain assessment","Physiotherapy referral"}'),
('Dermatology','dermatology','Skin, hair and nail conditions.','{"Skin assessment","Acne and eczema care","Minor skin procedures"}'),
('Laboratory Services','laboratory-services','Diagnostic testing to support clinical decisions.','{"Blood tests","Urinalysis","Sample collection"}'),
('Radiology and Imaging','radiology-imaging','Diagnostic imaging services.','{"X-ray","Ultrasound","Imaging reports"}'),
('Emergency Care','emergency-care','DEMO ONLY: this fictional department is not a real emergency service. In a real emergency, contact your local emergency number.','{"Triage information (demo)","Urgent care overview (demo)"}')
on conflict (slug) do nothing;

insert into public.doctors (department_id, full_name, specialty, bio, years_experience, available_days, slot_start, slot_end, slot_minutes)
select d.id, v.full_name, v.specialty, v.bio, v.yrs, v.days::smallint[], v.s::time, v.e::time, 30
from (values
 ('general-medicine','Dr. Adaeze Okonkwo','Family Medicine','Fictional example profile. Interested in preventive care and patient education.',12,'{1,2,3,4,5}','09:00','16:00'),
 ('general-medicine','Dr. Tunde Balogun','Internal Medicine','Fictional example profile focused on adult chronic condition care.',9,'{1,3,5}','10:00','17:00'),
 ('cardiology','Dr. Ibrahim Danjuma','Cardiologist','Fictional example profile with a focus on heart-health assessment.',15,'{2,4}','09:00','15:00'),
 ('cardiology','Dr. Ngozi Eze','Cardiologist','Fictional example profile specializing in preventive cardiology.',11,'{1,3,5}','09:00','14:00'),
 ('pediatrics','Dr. Funke Adeyemi','Pediatrician','Fictional example profile caring for infants and children.',10,'{1,2,3,4,5}','08:30','15:30'),
 ('pediatrics','Dr. Chidi Nwosu','Pediatrician','Fictional example profile focused on child development.',7,'{2,4,6}','09:00','13:00'),
 ('obstetrics-gynecology','Dr. Halima Sule','Obstetrician','Fictional example profile in antenatal and maternal care.',14,'{1,2,4}','09:00','16:00'),
 ('surgery','Dr. Emeka Obi','General Surgeon','Fictional example profile for general surgical consultation.',16,'{2,3,5}','10:00','16:00'),
 ('orthopedics','Dr. Segun Alabi','Orthopedic Surgeon','Fictional example profile for bone and joint conditions.',13,'{1,3,4}','09:00','15:00'),
 ('dermatology','Dr. Amara Ikenna','Dermatologist','Fictional example profile for skin health and common skin conditions.',8,'{1,2,3,4,5}','09:00','15:00'),
 ('laboratory-services','Dr. Yusuf Garba','Clinical Pathologist','Fictional example profile overseeing demonstration laboratory services.',10,'{1,2,3,4,5}','08:00','14:00'),
 ('radiology-imaging','Dr. Bisi Ogunleye','Radiologist','Fictional example profile for diagnostic imaging.',12,'{1,2,3,4,5}','09:00','16:00'),
 ('emergency-care','Dr. Kelechi Umeh','Emergency Physician (demo)','Fictional example profile. Demonstration only; not a real emergency service.',9,'{1,2,3,4,5}','09:00','15:00')
) as v(slug, full_name, specialty, bio, yrs, days, s, e)
join public.departments d on d.slug = v.slug
where not exists (select 1 from public.doctors x where x.full_name = v.full_name);
