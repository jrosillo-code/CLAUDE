#!/usr/bin/env python3
"""Generate the 'unverified' tier of country records from a compact table.

Everything in COUNTRIES was written from general knowledge on 2026-09-19,
without fetching the sources (unreachable from the build sandbox). Each record
is published with reviewTier "unverified", verifiedBy "claude-general-knowledge"
and the authority's official drone page as the URL to check. The founder
upgrades a record by reading that page and changing the tier.

Field shorthand per country:
  name, regime, auth, url, reg, cert, alt, dist, ins, imp, nofly[], app, cities{}, notes
  reg/cert/ins: True | False | None (None = depends; the note explains)
  imp: none | declare | banned | unknown
"""
import json, os, sys

DATE = "2026-09-19"
TAG = "claude-general-knowledge"
GEN = "Written from general knowledge on 2026-09-19 without fetching the sources; not verified. Confirm on the authority page before flying."

C = {}
def c(cc, name, regime, auth, url, reg, cert, alt, dist, ins, imp, nofly, app=None, cities=None, notes="", alt_note="", reg_note="", cert_note="", ins_note="", imp_note="", permit=None, weights=None):
    C[cc] = dict(name=name, regime=regime, auth=auth, url=url, reg=reg, cert=cert, alt=alt, dist=dist, ins=ins, imp=imp,
                 nofly=nofly, app=app, cities=cities or {}, notes=notes, alt_note=alt_note, reg_note=reg_note,
                 cert_note=cert_note, ins_note=ins_note, imp_note=imp_note, permit=permit, weights=weights or [])

VLOS = "Visual line of sight at all times."

# ── Americas ────────────────────────────────────────────────────────────────
c("CA", "Canada", "national", "Transport Canada", "https://tc.canada.ca/en/aviation/drone-safety",
  True, True, 122, VLOS, None, "none",
  ["Within 5.6 km of airports and 1.9 km of heliports without authorization", "National parks (Parks Canada prohibits take-off and landing without a permit)", "Over people and advertised events"],
  app={"name": "NAV CANADA NAV Drone", "url": "https://www.navcanada.ca/en/flight-planning/drone-flight-planning.aspx"},
  cities={"Toronto": "Downtown is largely controlled airspace around Billy Bishop and Pearson; NAV Drone authorization applies.", "Vancouver": "Harbour and downtown sit under YVR and harbour heliport airspace; parks require permission.", "Banff": "Parks Canada bans drones in national parks without a permit."},
  reg_note="Registration and a pilot certificate (basic or advanced) apply from 250 g; sub-250 g drones are exempt from both but not from the rules.",
  cert_note="Basic or advanced certificate from 250 g; foreigners can sit the online basic exam.",
  ins_note="No general mandate; provincial and site rules vary.",
  weights=[{"maxGrams": 250, "summary": "Micro: no registration or certificate, still no flying over people or near aircraft."}, {"maxGrams": 25000, "summary": "Small: registration and basic/advanced certificate; NAV Drone for controlled airspace."}])
c("MX", "Mexico", "national", "AFAC (Agencia Federal de Aviación Civil)", "https://www.gob.mx/afac",
  None, None, 122, VLOS, None, "declare",
  ["Archaeological sites (INAH requires a permit)", "Within 9 km of airports", "Over crowds and government buildings"],
  cities={"Mexico City": "Heavily restricted: airport approaches and government zones; INAH covers Teotihuacán and the Zócalo area.", "Cancún": "Hotel-zone flights sit under the airport approach; resorts have their own rules.", "Oaxaca": "Monte Albán and the historic centre require INAH permission."},
  reg_note="Registration with AFAC is required above 250 g; below that recreational flights are largely exempt.",
  cert_note="No licence for recreational sub-250 g; heavier and commercial classes need AFAC procedures.",
  imp_note="Customs may ask for the AFAC registration or a declaration; travellers report inconsistent handling.")
c("BR", "Brazil", "national", "ANAC / DECEA", "https://www.gov.br/anac/pt-br/assuntos/drones",
  True, None, 120, VLOS, True, "declare",
  ["Within airport control zones without DECEA authorization", "Over crowds and within 30 m of people who have not consented", "National parks without ICMBio permission"],
  app={"name": "DECEA SARPAS", "url": "https://sarpas.decea.mil.br/"},
  cities={"Rio de Janeiro": "Copacabana, Sugarloaf and Christ the Redeemer sit in controlled airspace; SARPAS request needed.", "São Paulo": "Dense controlled airspace around Congonhas and Guarulhos."},
  reg_note="SISANT registration required above 250 g; every flight in controlled airspace needs a SARPAS request.",
  cert_note="No licence below 25 kg for recreational use; foreign operators register with a CPF or passport.",
  ins_note="Third-party liability insurance is required above 250 g.",
  imp_note="ANATEL homologation of the radio equipment is formally required; customs may ask.")
c("AR", "Argentina", "national", "ANAC Argentina", "https://www.argentina.gob.ar/anac/vant",
  True, None, 120, VLOS, True, "unknown",
  ["Within 5 km of airports", "Over urban areas without authorization", "National parks without APN permission"],
  cities={"Buenos Aires": "Urban flights need ANAC authorization; Puerto Madero and Palermo parks are commonly refused.", "El Calafate": "Los Glaciares national park bans drones without a permit."},
  reg_note="Registration required from 250 g; sub-250 g recreational drones are exempt from registration but not from operating rules.",
  ins_note="Liability insurance is mandatory for registered drones.")
c("CL", "Chile", "national", "DGAC Chile", "https://www.dgac.gob.cl/",
  True, None, 130, VLOS, True, "unknown",
  ["Populated areas without DGAC authorization (DAN 151)", "Within 2 km of aerodromes", "Torres del Paine and other CONAF parks"],
  cities={"Santiago": "Urban flights fall under DAN 151 authorization; the airport approach covers the north-west.", "Torres del Paine": "CONAF prohibits drones in the park."},
  reg_note="DGAC registration and a credential are required for flights over populated areas; rural recreational flights under 750 g are lighter-touch.",
  ins_note="Insurance is required for flights over populated areas.")
c("PE", "Peru", "national", "DGAC Perú (MTC)", "https://www.gob.pe/mtc",
  True, None, 120, VLOS, None, "declare",
  ["Machu Picchu and all Ministry of Culture archaeological sites", "Within 4 km of airports", "Over crowds"],
  cities={"Cusco": "Machu Picchu, Sacsayhuamán and the Sacred Valley sites ban drones; enforcement is active.", "Lima": "Miraflores cliffs sit under the airport approach; municipal permission is asked."},
  reg_note="Registration with DGAC is required; foreign visitors have reported it is slow to obtain.",
  imp_note="Customs regularly asks for the registration; declare the drone.")
c("CO", "Colombia", "national", "Aerocivil", "https://www.aerocivil.gov.co/",
  None, None, 120, VLOS, None, "unknown",
  ["Within 5 km of airports", "Over crowds and public events", "National natural parks"],
  cities={"Bogotá": "El Dorado's approaches cover much of the west of the city.", "Cartagena": "The walled city and Bocagrande sit under the airport approach."},
  reg_note="Recreational use under 25 kg is lightly regulated; commercial use requires Aerocivil registration and a course.")
c("CR", "Costa Rica", "national", "DGAC Costa Rica", "https://www.dgac.go.cr/",
  True, None, 120, VLOS, True, "unknown",
  ["National parks (SINAC requires a permit)", "Within 8 km of airports", "Over people"],
  cities={"Manuel Antonio": "National park; drones prohibited without SINAC permission.", "Arenal": "Volcano park area requires a permit."},
  reg_note="DGAC registration is required for drones over 250 g; foreigners register with a passport.",
  ins_note="Liability insurance is required for registered drones.")
c("PA", "Panama", "national", "AAC Panamá", "https://www.aeronautica.gob.pa/",
  True, None, 120, VLOS, None, "unknown",
  ["Within 5 km of airports", "Panama Canal zone", "Over crowds"],
  cities={"Panama City": "Albrook airport and the canal restrict most of the centre."})
c("EC", "Ecuador", "national", "DGAC Ecuador", "https://www.aviacioncivil.gob.ec/",
  None, None, 122, VLOS, None, "unknown",
  ["Galápagos (national park prohibits drones without a research permit)", "Within 9 km of airports", "Over crowds"],
  cities={"Galápagos": "Drones are prohibited in the national park; do not bring one expecting to fly.", "Quito": "The historic centre and airport approaches restrict flights."})
c("UY", "Uruguay", "national", "DINACIA", "https://www.gub.uy/dinacia",
  True, None, 120, VLOS, True, "unknown",
  ["Within 5 km of airports", "Over urban areas without authorization"],
  reg_note="Registration required above 250 g.", ins_note="Liability insurance is required for registered drones.")
c("DO", "Dominican Republic", "national", "IDAC", "https://www.idac.gob.do/",
  True, None, 120, VLOS, None, "declare",
  ["Resort areas near Punta Cana airport", "Over crowds"],
  imp_note="IDAC requires registration before entry for heavier drones; customs may hold unregistered units.")
c("CU", "Cuba", "national", "IACC", "https://www.iacc.gob.cu/",
  None, None, None, VLOS, None, "banned",
  ["Effectively everywhere without a state permit"],
  alt_note="No general ceiling published for private use; private flights are not normally authorised.",
  imp_note="Drones are routinely confiscated at customs; do not bring one.")

# ── Europe outside EASA ─────────────────────────────────────────────────────
c("TR", "Türkiye", "national", "SHGM (DGCA Türkiye)", "https://web.shgm.gov.tr/",
  True, None, 120, VLOS, None, "declare",
  ["Istanbul's historic peninsula and the Bosphorus without permission", "Cappadocia balloon areas at flight times", "Military zones and within 9 km of airports"],
  app={"name": "İHA Kayıt Sistemi", "url": "https://iha.shgm.gov.tr/"},
  cities={"Istanbul": "Hagia Sophia, Topkapı and the Bosphorus are restricted; permits go through the governorship.", "Cappadocia": "Balloon operations at dawn; flights near them are prohibited."},
  reg_note="Drones over 500 g must be registered in the SHGM system; foreigners need a Turkish ID equivalent or an agent.",
  imp_note="Customs may ask for the SHGM registration; declare drones over 500 g.")
c("RS", "Serbia", "national", "CAD Serbia", "https://cad.gov.rs/",
  None, None, 100, VLOS, None, "unknown",
  ["Belgrade centre without permission", "Within 5 km of airports"],
  cities={"Belgrade": "Flights over the city need CAD approval; Kalemegdan is often refused."},
  reg_note="Registration depends on the class; foreign operators generally need approval.")
c("BA", "Bosnia and Herzegovina", "national", "BHDCA", "https://www.bhdca.gov.ba/",
  None, None, 100, VLOS, None, "unknown", ["Mostar's old bridge area without municipal permission", "Within 5 km of airports"])
c("ME", "Montenegro", "national", "CAA Montenegro", "https://caa.me/",
  None, None, 100, VLOS, None, "unknown", ["Kotor bay under Tivat airport approach", "National parks"],
  cities={"Kotor": "The bay is under Tivat's approach; check with the CAA."})
c("MK", "North Macedonia", "national", "CAA North Macedonia", "https://caa.gov.mk/",
  None, None, 100, VLOS, None, "unknown", ["Ohrid old town and Kaneo (heritage site)", "Within 5 km of airports"],
  cities={"Ohrid": "The heritage zone needs municipal permission; the lakeside is generally tolerated away from the old town."})
c("AL", "Albania", "national", "AAC Albania", "https://www.aac.gov.al/",
  None, None, 120, VLOS, None, "unknown", ["Tirana airport zone", "Butrint archaeological park"])
c("UA", "Ukraine", "national", "State Aviation Service of Ukraine", "https://avia.gov.ua/",
  None, None, None, VLOS, None, "banned",
  ["Civilian drone flights are prohibited nationwide under martial law"],
  alt_note="No civilian flying while martial law is in force.", imp_note="Do not bring a drone; it will be treated as military equipment.")
c("GE", "Georgia", "national", "GCAA Georgia", "https://gcaa.gov.ge/",
  True, None, 120, VLOS, None, "unknown", ["Tbilisi centre without permission", "Border zones", "Within 6 km of airports"],
  cities={"Tbilisi": "Old town flights need GCAA and municipal permission."},
  reg_note="Registration required from 250 g; heavier classes need a certificate.")
c("AM", "Armenia", "national", "GDCA Armenia", "https://www.aviation.am/",
  None, None, 120, VLOS, None, "unknown", ["Border areas with Azerbaijan and Türkiye", "Yerevan centre"])
c("GB", "United Kingdom", "national", "UK CAA", "https://www.caa.co.uk/drones",
  True, True, 120, VLOS, None, "none",
  ["Flight restriction zones around airports", "Over crowds and within 50 m of uninvolved people (except sub-250 g)", "Royal parks and many National Trust sites by bylaw"],
  app={"name": "Drone Assist (Altitude Angel)", "url": "https://dronesafetymap.com/"},
  cities={"London": "Almost all of central London is inside the Heathrow and City FRZs or royal-park bylaws; assume no.", "Edinburgh": "The castle and Old Town sit inside the airport FRZ.", "Lake District": "Open access, but the national park asks for permission at popular sites."},
  reg_note="Operator ID required for any drone with a camera or above 250 g.",
  cert_note="Flyer ID (free online test) for 250 g and above; A2 CofC for closer flying with C1/C2 aircraft.",
  ins_note="Not mandatory for recreational sub-20 kg; required for commercial operations.")

# ── Asia ────────────────────────────────────────────────────────────────────
c("KR", "South Korea", "national", "MOLIT / KOCA", "https://www.molit.go.kr/",
  None, None, 150, VLOS, None, "unknown",
  ["Most of Seoul is prohibited (P-73) or restricted; the Han river has limited permitted zones", "Within 9.3 km of airports", "Near the DMZ and military installations"],
  app={"name": "Ready to Fly (드론 원스톱)", "url": "https://drone.onestop.go.kr/"},
  cities={"Seoul": "Central Seoul is a no-fly zone; only a few designated riverside parks allow flights with prior approval.", "Busan": "Beaches sit under Gimhae's airspace; check the app."},
  reg_note="Registration required above 250 g for hobby use; pilots of 250 g–7 kg need an online course, heavier need a licence.",
  cert_note="Online course certificate from 250 g; licence above 7 kg.")
c("IN", "India", "national", "DGCA (Digital Sky)", "https://digitalsky.dgca.gov.in/",
  True, None, 120, VLOS, None, "declare",
  ["Red zones around airports, borders and military areas", "Delhi, Mumbai airports and much of the capital region", "Monuments under the Archaeological Survey of India"],
  app={"name": "Digital Sky airspace map", "url": "https://digitalsky.dgca.gov.in/airspace-map/"},
  cities={"Delhi": "Almost entirely red zone; no recreational flights.", "Goa": "Beaches are largely yellow/green but airport approaches at Dabolim and Mopa cut across them.", "Agra": "The Taj Mahal is a no-fly zone."},
  reg_note="Every drone above 250 g needs a UIN on Digital Sky; foreign nationals cannot register in their own name and must go through an Indian entity.",
  imp_note="Import requires DGCA approval; customs seizures of undeclared drones are common.")
c("ID", "Indonesia", "national", "DGCA Indonesia (Kemenhub)", "https://hubud.dephub.go.id/",
  None, None, 150, VLOS, None, "unknown",
  ["Within 15 km of airports", "Bali temples and ceremonies (customary bans)", "Komodo and other national parks without a permit"],
  cities={"Bali": "Ngurah Rai's approach covers Kuta to Sanur; temples like Uluwatu and Tanah Lot refuse drones.", "Yogyakarta": "Borobudur and Prambanan require permits from the park authorities."},
  reg_note="Registration through the SIDOPI system applies to drones over 250 g; enforcement is uneven.")
c("VN", "Vietnam", "national", "Ministry of National Defence (via CAAV)", "https://caa.gov.vn/",
  None, None, None, VLOS, None, "declare",
  ["Everywhere without a Ministry of Defence permit, which foreigners rarely obtain", "Ha Long Bay, Hanoi and Ho Chi Minh City centres"],
  alt_note="No general ceiling; every flight needs a permit that sets it.",
  cities={"Hanoi": "Old Quarter and Hoan Kiem are no-fly without a permit.", "Ha Long Bay": "Tour boats ban drones; the bay is restricted."},
  imp_note="Customs may hold drones without a permit letter; declare them.")
c("MY", "Malaysia", "national", "CAAM", "https://www.caam.gov.my/",
  True, None, 120, VLOS, None, "unknown",
  ["Kuala Lumpur city centre (KLCC/Petronas) without a permit", "Within 5 km of airports", "Putrajaya"],
  app={"name": "CAAM UAS portal", "url": "https://uas.caam.gov.my/"},
  cities={"Kuala Lumpur": "The city centre is restricted; permits through CAAM's UAS portal.", "Langkawi": "Airport approach covers much of the south-west; beaches to the north are commonly flown."},
  reg_note="Registration on the CAAM portal from 250 g; the Authority to Fly is needed for many areas.")
c("PH", "Philippines", "national", "CAAP", "https://caap.gov.ph/",
  None, None, 122, VLOS, None, "unknown",
  ["Metro Manila and NAIA airspace", "Boracay by local ordinance", "Within 10 km of airports"],
  cities={"Manila": "Controlled airspace; CAAP permit needed.", "Palawan": "El Nido and Coron are commonly flown outside airport zones; the park office may ask."},
  reg_note="Recreational drones under 7 kg are exempt from CAAP registration if flown outside controlled areas; commercial use needs a certificate.")
c("CN", "China", "national", "CAAC (UOM)", "https://uom.caac.gov.cn/",
  True, None, 120, VLOS, None, "declare",
  ["Beijing inside the 6th ring road", "All cities' controlled airspace without approval", "Border regions and Tibet"],
  app={"name": "UOM (Unmanned aircraft Operation Management)", "url": "https://uom.caac.gov.cn/"},
  cities={"Beijing": "The city is a no-fly zone for civilian drones.", "Shanghai": "Most of the centre is restricted; the Bund is enforced.", "Guilin/Yangshuo": "Widely flown by visitors but formally requires approval."},
  reg_note="Real-name registration on UOM for any drone above 250 g; foreign passports are accepted on the site.",
  imp_note="Declare the drone; DJI units are ubiquitous but customs can ask for registration.")
c("TW", "Taiwan", "national", "CAA Taiwan", "https://www.caa.gov.tw/",
  True, None, 120, VLOS, None, "unknown",
  ["Taipei city without municipal approval", "Within airport control zones", "National parks (Taroko, Yushan) without a permit"],
  app={"name": "CAA drone map", "url": "https://drone.caa.gov.tw/"},
  cities={"Taipei": "The city requires prior approval for most areas; Elephant Mountain views are commonly refused."},
  reg_note="Registration from 250 g; drones over 2 kg need an operator certificate.")
c("HK", "Hong Kong", "national", "CAD Hong Kong", "https://www.cad.gov.hk/english/sua.html",
  True, None, 90, VLOS, True, "unknown",
  ["Victoria Harbour and most of Kowloon under the SUA rules", "Within 5 km of the airport", "Over people"],
  app={"name": "eSUA portal", "url": "https://esua.cad.gov.hk/"},
  cities={"Hong Kong": "Category A2 (250 g–7 kg) needs registration and a course; the harbour skyline is restricted."},
  reg_note="Registration for drones over 250 g; A1 (sub-250 g) has fewer requirements.", ins_note="Liability insurance is required from 250 g.")
c("NP", "Nepal", "national", "CAAN", "https://caanepal.gov.np/",
  None, None, 120, VLOS, None, "declare",
  ["Everest region and all national parks without a CAAN and park permit", "Kathmandu valley heritage sites", "Within 5 km of airports"],
  cities={"Kathmandu": "Durbar squares and Boudhanath refuse drones; airport approach covers the valley.", "Everest region": "Sagarmatha park requires multiple permits; commonly refused to tourists."},
  imp_note="Customs asks for a permit; drones are often held at the airport on arrival.")
c("LK", "Sri Lanka", "national", "CAA Sri Lanka", "https://www.caa.lk/",
  True, None, 120, VLOS, None, "unknown",
  ["Sigiriya and other archaeological sites", "Within 5 km of airports", "Military areas in the north and east"],
  cities={"Sigiriya": "Flights near the rock require Department of Archaeology permission.", "Ella": "Popular and usually tolerated away from the rail line and people."},
  reg_note="Registration with CAASL from 250 g; foreigners register online.")
c("KH", "Cambodia", "national", "SSCA", "https://www.civilaviation.gov.kh/",
  None, None, 120, VLOS, None, "unknown",
  ["Angkor Archaeological Park (APSARA prohibits drones without a permit)", "Phnom Penh royal palace and airport"],
  cities={"Siem Reap": "Angkor is a no-fly zone without APSARA permission."})
c("LA", "Laos", "national", "DCA Laos", "https://www.dca.gov.la/",
  None, None, 120, VLOS, None, "unknown", ["Luang Prabang heritage town without permission", "Airport zones"],
  cities={"Luang Prabang": "The heritage office asks for permits; morning alms areas are refused."})
c("MN", "Mongolia", "national", "CAA Mongolia", "https://www.mcaa.gov.mn/",
  None, None, 120, VLOS, None, "unknown", ["Ulaanbaatar airport zone", "Border areas"],
  notes="Open countryside is widely flown; formal permits exist for commercial use.")
c("KZ", "Kazakhstan", "national", "Aviation Administration of Kazakhstan", "https://aak.gov.kz/",
  True, None, 120, VLOS, None, "declare", ["Almaty and Astana without approval", "Border zones and near Baikonur"],
  reg_note="Registration required above 1.5 kg; lighter drones have simpler rules.")
c("UZ", "Uzbekistan", "national", "Uzaviation", "https://uzaviation.uz/",
  None, None, None, VLOS, None, "banned", ["All private drone flights without a state permit"],
  alt_note="Private flying is not permitted without a licence that tourists do not get.", imp_note="Drones are confiscated at the border without a permit.")
c("KG", "Kyrgyzstan", "national", "Civil Aviation Agency of Kyrgyzstan", "https://caa.gov.kg/",
  None, None, 120, VLOS, None, "unknown", ["Bishkek airport zone", "Border areas"],
  notes="Mountain areas are commonly flown; formal registration exists for heavier drones.")
c("AE", "United Arab Emirates", "national", "GCAA / Dubai Civil Aviation Authority", "https://www.gcaa.gov.ae/",
  True, True, 120, VLOS, None, "declare",
  ["Dubai: no flying without DCAA registration and a permit; most of the city is no-fly", "Abu Dhabi: everything needs a permit", "Near airports and the palm islands"],
  app={"name": "DCAA / GCAA registration", "url": "https://www.dcaa.gov.ae/"},
  cities={"Dubai": "Recreational flights are only allowed in designated flying zones, with registration; the marina and downtown are no-fly.", "Abu Dhabi": "Permit required for any flight."},
  reg_note="Registration is mandatory for all drones; tourists can register on the app but permits are rarely granted.",
  cert_note="A certificate is required for heavier drones and any commercial use.",
  imp_note="Declare on entry; unregistered drones have been held at the airport.")
c("SA", "Saudi Arabia", "national", "GACA", "https://gaca.gov.sa/",
  True, None, 120, VLOS, None, "declare",
  ["Riyadh and Jeddah centres without a permit", "Holy cities of Makkah and Madinah", "Border and oil facilities"],
  cities={"AlUla": "Royal Commission permits are required; drones commonly refused at heritage sites."},
  reg_note="GACA registration is required for every drone; visitors register with a passport.",
  imp_note="Customs requires the GACA registration; declare the drone.")
c("QA", "Qatar", "national", "QCAA", "https://www.caa.gov.qa/",
  True, None, 120, VLOS, None, "declare", ["Doha without a QCAA permit", "Airports and the corniche"],
  cities={"Doha": "Permit required for any flight in the city."}, imp_note="Customs may hold drones without a permit.")
c("OM", "Oman", "national", "CAA Oman", "https://www.caa.gov.om/",
  None, None, 120, VLOS, None, "banned", ["Nationwide without a CAA permit; tourists are not normally granted one"],
  imp_note="Drones are confiscated at entry without a permit; do not bring one.")
c("JO", "Jordan", "national", "CARC Jordan", "https://carc.gov.jo/",
  None, None, None, VLOS, None, "banned", ["Petra, Wadi Rum and the Dead Sea without a security permit"],
  alt_note="Private flights are not permitted without a CARC and security clearance.", imp_note="Drones are held at customs on arrival and returned on departure.")
c("IL", "Israel", "national", "CAAI", "https://www.gov.il/en/departments/civil_aviation_authority",
  True, None, 50, VLOS, None, "declare", ["Jerusalem Old City and most of the centre", "Airports and military zones (extensive)", "Border areas"],
  cities={"Jerusalem": "The Old City and its surroundings are no-fly.", "Tel Aviv": "Beach flights sit under Ben Gurion's airspace; check the CAAI map."},
  reg_note="Registration and a licence are required above 250 g.", alt_note="50 m general ceiling for hobby flights without authorization.")
c("MV", "Maldives", "national", "Maldives Civil Aviation Authority", "https://www.caa.gov.mv/",
  True, None, 120, VLOS, None, "declare", ["Malé and Velana airport zone", "Resort islands set their own rules; many prohibit drones"],
  cities={"Malé": "Airport island and the capital are restricted; resorts decide for their islands."},
  reg_note="MCAA registration is required; tourists register with a passport and resort letter.", imp_note="Customs asks for the registration on arrival.")
c("BT", "Bhutan", "national", "BCAA", "https://www.bcaa.gov.bt/",
  None, None, None, VLOS, None, "banned", ["Nationwide without a government permit"],
  alt_note="Private drones are not permitted.", imp_note="Drones are not allowed into the country without prior approval.")
c("TH", "Thailand", "national", "CAAT", "https://www.caat.or.th/en/",
  True, None, 90, VLOS, True, "declare",
  ["Bangkok's royal and government zones", "Within 9 km of airports", "National parks without DNP permission", "Temples and palaces"],
  app={"name": "CAAT UAS portal", "url": "https://uas.caat.or.th/"},
  cities={"Bangkok": "The Grand Palace and much of the centre are restricted; airport approaches cover Suvarnabhumi and Don Mueang.", "Phuket": "Beaches near the airport are restricted; national park islands need DNP permission.", "Chiang Mai": "Old city temples refuse drones; the airport sits beside the centre."},
  reg_note="Camera drones must be registered with CAAT (and historically NBTC for the radio); tourists can register online.",
  ins_note="Third-party insurance is required for registration.", imp_note="Declare; customs asks for the CAAT and NBTC registrations.")
c("SG", "Singapore", "national", "CAAS", "https://www.caas.gov.sg/",
  True, None, 60, VLOS, None, "declare",
  ["Most of the island is within 5 km of an airport or airbase and needs a permit", "Marina Bay and the CBD", "Sentosa"],
  app={"name": "OneMap drone query", "url": "https://www.onemap.gov.sg/"},
  cities={"Singapore": "Registration from 250 g; a permit is needed almost everywhere; fines are heavy."},
  reg_note="Registration is required for drones above 250 g; a UA Basic Training certificate for 1.5–7 kg.",
  imp_note="Declare on entry; unregistered drones have been fined.")
c("JP", "Japan", "national", "MLIT Civil Aviation Bureau", "https://www.mlit.go.jp/en/koku/uas.html",
  True, None, 150, VLOS, None, "declare",
  ["Densely inhabited districts (DID) — most of every city", "Within 6 km of airports", "Over people, near events, at night without approval"],
  app={"name": "DIPS 2.0", "url": "https://www.ossportal.dips.mlit.go.jp/portal/top/"},
  cities={"Tokyo": "The whole 23-ward area is DID and public parks ban drones; assume no.", "Kyoto": "DID covers the city; temples refuse drones.", "Hokkaido": "Open areas outside DID are the realistic option."},
  reg_note="Registration and Remote ID from 100 g; foreigners register on DIPS with a passport.",
  imp_note="Declare; registration is checked on the spot by police.")

# ── Africa ──────────────────────────────────────────────────────────────────
c("ZA", "South Africa", "national", "SACAA", "https://www.caa.co.za/",
  None, None, 120, VLOS, None, "none",
  ["Kruger and SANParks (drones prohibited)", "Within 10 km of airports", "Over people and near buildings without consent"],
  cities={"Cape Town": "Table Mountain national park prohibits drones; the city centre is under the airport approach.", "Kruger": "SANParks bans drones; rangers enforce it."},
  reg_note="Private (hobby) use needs no registration; any commercial use requires an RPL and ROC, which take months.")
c("MA", "Morocco", "national", "DGAC Morocco (ONDA)", "https://www.onda.ma/",
  None, None, None, VLOS, None, "banned", ["Nationwide without a permit that tourists do not get"],
  alt_note="Private flights are not permitted.", imp_note="Drones are confiscated at customs and returned on departure at best.")
c("EG", "Egypt", "national", "ECAA", "https://www.civilaviation.gov.eg/",
  None, None, None, VLOS, None, "banned", ["Nationwide without a Ministry of Defence permit"],
  alt_note="Private flights are not permitted.", imp_note="Bringing a drone in without a permit is an offence; do not.")
c("KE", "Kenya", "national", "KCAA", "https://www.kcaa.or.ke/",
  True, True, 120, VLOS, True, "declare",
  ["National parks and reserves (KWS permit required)", "Within 5 km of airports", "Nairobi centre"],
  cities={"Maasai Mara": "KWS and conservancy permits are required and rarely granted to tourists.", "Nairobi": "Registration and a permit for any city flight."},
  reg_note="KCAA registration and an operator permit are required; foreigners must import with KCAA approval.",
  cert_note="A remote pilot licence is required.", ins_note="Liability insurance is required.", imp_note="Import needs prior KCAA approval; customs holds drones without it.")
c("TZ", "Tanzania", "national", "TCAA", "https://www.tcaa.go.tz/",
  True, None, 120, VLOS, None, "declare",
  ["Serengeti, Ngorongoro and all national parks without TANAPA permission", "Zanzibar Stone Town"],
  cities={"Zanzibar": "Beaches are commonly flown; Stone Town and the airport zone are restricted.", "Serengeti": "TANAPA permit required; expensive and slow."},
  reg_note="TCAA registration and a permit are required for foreigners.", imp_note="Declare on arrival with the TCAA permit.")
c("NA", "Namibia", "national", "NCAA Namibia", "https://www.ncaa.na/",
  None, None, 120, VLOS, None, "declare",
  ["Sossusvlei and all national parks without MEFT permission", "Etosha", "Within 5 km of airports"],
  cities={"Sossusvlei": "NamibRand and the park require permits; commonly refused.", "Swakopmund": "Coast flights are commonly done outside the airfield zone."},
  reg_note="Recreational drones need an NCAA authorisation letter, applied for in advance.", imp_note="Customs asks for the NCAA letter.")
c("BW", "Botswana", "national", "CAAB", "https://www.caab.co.bw/",
  True, None, 120, VLOS, None, "declare", ["Okavango Delta and all parks (drones prohibited)", "Airports"],
  cities={"Okavango": "Drones are prohibited in the Delta and reserves."}, reg_note="CAAB registration and a permit are required.", imp_note="Declare; permits are needed to bring one in.")
c("RW", "Rwanda", "national", "RCAA", "https://www.rcaa.gov.rw/",
  True, None, 120, VLOS, None, "declare", ["Volcanoes national park (gorillas)", "Kigali without a permit"],
  reg_note="RCAA registration and a permit; the process is online and relatively organised.", imp_note="Import requires RCAA approval.")
c("UG", "Uganda", "national", "UCAA", "https://www.caa.go.ug/",
  True, None, 120, VLOS, None, "declare", ["National parks (UWA permit)", "Entebbe airport and Kampala"],
  reg_note="UCAA registration and a permit through a security clearance.", imp_note="Import needs UCAA approval.")
c("GH", "Ghana", "national", "GCAA Ghana", "https://www.gcaa.com.gh/",
  True, None, 120, VLOS, None, "declare", ["Accra airport zone", "Government buildings"],
  reg_note="GCAA registration is required; foreigners register through an agent.", imp_note="Import permit required.")
c("NG", "Nigeria", "national", "NCAA Nigeria", "https://ncaa.gov.ng/",
  True, None, 120, VLOS, None, "declare", ["Lagos and Abuja without a permit", "Airports and government areas"],
  reg_note="NCAA registration and a security clearance are required; the process is slow.", imp_note="Import permit required.")
c("ET", "Ethiopia", "national", "ECAA Ethiopia", "https://www.ecaa.gov.et/",
  None, None, None, VLOS, None, "banned", ["Nationwide without a permit", "Lalibela and Danakil"],
  alt_note="Private flights are not permitted without a permit.", imp_note="Drones are confiscated at customs without prior approval.")
c("MU", "Mauritius", "national", "DCA Mauritius", "https://civil-aviation.govmu.org/",
  True, None, 120, VLOS, None, "declare", ["Within 5 km of the airport", "Over people and hotels without consent"],
  reg_note="DCA registration is required; tourists apply in advance.")
c("SC", "Seychelles", "national", "SCAA", "https://www.scaa.sc/",
  True, None, 120, VLOS, None, "declare", ["Airport zone on Mahé", "Nature reserves (Vallée de Mai, Aldabra)"],
  reg_note="SCAA registration and a permit are required.", imp_note="Customs holds drones without a permit.")
c("TN", "Tunisia", "national", "OACA", "https://www.oaca.nat.tn/",
  None, None, None, VLOS, None, "banned", ["Nationwide without a permit"], alt_note="Private flights are not permitted.", imp_note="Drones are confiscated at customs.")

# ── Oceania ─────────────────────────────────────────────────────────────────
c("AU", "Australia", "national", "CASA", "https://www.casa.gov.au/drones",
  None, None, 120, VLOS, None, "none",
  ["Within 5.5 km of controlled aerodromes", "Over people and populous areas", "National parks by state rules (NSW, VIC and others prohibit without permission)", "Sydney Harbour and the CBD"],
  app={"name": "OpenSky / CASA-verified drone safety apps", "url": "https://www.casa.gov.au/knowyourdrone/drone-safety-apps"},
  cities={"Sydney": "The harbour, Bondi and the CBD sit inside Sydney Airport's zone and helicopter lanes.", "Uluru": "Drones are prohibited in the national park.", "Great Ocean Road": "Twelve Apostles is inside Port Campbell national park; Parks Victoria prohibits drones."},
  reg_note="Recreational drones need no registration or accreditation as of the last known rules; commercial use above 250 g requires registration and RePL or an excluded-category notice.",
  cert_note="No licence for recreational use; RePL for commercial above 2 kg.")
c("NZ", "New Zealand", "national", "CAA New Zealand", "https://www.aviation.govt.nz/drones/",
  False, False, 120, VLOS, None, "none",
  ["Within 4 km of aerodromes without permission", "Over people or property without consent", "DOC conservation land without a concession", "Milford Sound and Queenstown (airport and heli traffic)"],
  app={"name": "AirShare", "url": "https://www.airshare.co.nz/"},
  cities={"Queenstown": "The airport zone covers the town; the lakefront is a no-fly.", "Milford Sound": "DOC land and heavy scenic-flight traffic; drones are not permitted.", "Auckland": "Council bylaws restrict parks; the harbour is under the airport approach."},
  reg_note="No registration for Part 101 recreational flying under 25 kg; consent of the landowner and people overflown is the binding rule.",
  cert_note="No certificate under Part 101; Part 102 certification for anything outside those rules.")
c("FJ", "Fiji", "national", "CAAF", "https://www.caaf.org.fj/",
  True, None, 120, VLOS, None, "declare", ["Nadi and Nausori airport zones", "Resort islands set their own rules"],
  reg_note="CAAF registration is required; resorts often require their own permission.", imp_note="Customs asks for the CAAF registration.")
c("PF", "French Polynesia", "national", "DGAC / SEAC Polynésie française", "https://www.seac.pf/",
  None, None, 120, VLOS, None, "unknown", ["Faa'a airport zone in Tahiti", "Bora Bora resorts (many prohibit drones)", "Marae and sacred sites"],
  cities={"Bora Bora": "The airport is on the lagoon; resorts decide for their motu."},
  notes="French national rules apply with local adaptations; EU/EASA regulations do not apply in the collectivity.")

# ── output ──────────────────────────────────────────────────────────────────
OUT = os.path.join(os.path.dirname(__file__), "..", "..", "lib", "fieldbrief", "rules")
AUTH = os.path.join(os.path.dirname(__file__), "..", "..", "lib", "fieldbrief", "authorities.json")
REGION = {"CA":"Americas","MX":"Americas","BR":"Americas","AR":"Americas","CL":"Americas","PE":"Americas","CO":"Americas","CR":"Americas","PA":"Americas","EC":"Americas","UY":"Americas","DO":"Americas","CU":"Americas",
          "TR":"Europe","RS":"Europe","BA":"Europe","ME":"Europe","MK":"Europe","AL":"Europe","UA":"Europe","GE":"Europe","AM":"Europe","GB":"Europe",
          "KR":"Asia","IN":"Asia","ID":"Asia","VN":"Asia","MY":"Asia","PH":"Asia","CN":"Asia","TW":"Asia","HK":"Asia","NP":"Asia","LK":"Asia","KH":"Asia","LA":"Asia","MN":"Asia","KZ":"Asia","UZ":"Asia","KG":"Asia","AE":"Asia","SA":"Asia","QA":"Asia","OM":"Asia","JO":"Asia","IL":"Asia","MV":"Asia","BT":"Asia","TH":"Asia","SG":"Asia","JP":"Asia",
          "ZA":"Africa","MA":"Africa","EG":"Africa","KE":"Africa","TZ":"Africa","NA":"Africa","BW":"Africa","RW":"Africa","UG":"Africa","GH":"Africa","NG":"Africa","ET":"Africa","MU":"Africa","SC":"Africa","TN":"Africa",
          "AU":"Oceania","NZ":"Oceania","FJ":"Oceania","PF":"Oceania"}

def flag(v, note, what):
    if v is None and not note:
        note = f"Depends on the aircraft and the operation; not established in this summary. Check the authority for {what}."
    return {"value": v, "note": note}

written, skipped = [], []
for cc, d in C.items():
    path = os.path.join(OUT, f"{cc.lower()}.json")
    if os.path.exists(path):
        # never overwrite a desk-review or verified record; only add city notes if absent
        existing = json.load(open(path))
        if existing.get("reviewTier") in ("verified", "desk-review"):
            if d["cities"] and not existing.get("cityNotes"):
                existing["cityNotes"] = [{"city": k, "note": v, "reviewTier": "unverified"} for k, v in d["cities"].items()]
                json.dump(existing, open(path, "w"), indent=2, ensure_ascii=False); open(path, "a").write("\n")
            skipped.append(cc)
            continue
    rec = {
        "countryCode": cc, "countryName": d["name"], "regime": d["regime"], "reviewTier": "unverified", "coverage": "national",
        "scope": "Unverified summary of the headline national rules for a visiting hobby pilot. Commercial filming, local by-laws and site permissions are not covered.",
        "authorityName": d["auth"], "authorityUrl": d["url"],
        "registrationRequired": flag(d["reg"], d["reg_note"], "registration"),
        "pilotCertRequired": flag(d["cert"], d["cert_note"], "pilot certification"),
        "weightClasses": d["weights"],
        "maxAltitudeM": d["alt"], "altitudeNote": d["alt_note"] or ("General ceiling for hobby flights; lower limits apply near aerodromes and in restricted zones." if d["alt"] is not None else "No general ceiling established."),
        "maxDistanceRule": d["dist"],
        "insuranceRequired": flag(d["ins"], d["ins_note"], "insurance"),
        "importRestriction": {"value": d["imp"], "note": d["imp_note"] or {"none": "No import restriction known for personal drones.", "declare": "Declare the drone at customs; registration or a permit may be asked for.", "banned": "Do not bring a drone; it will be held or confiscated.", "unknown": "Import and radio-equipment rules not established in this summary."}[d["imp"]]},
        "noFlyHighlights": d["nofly"],
        "permitProcess": d["permit"],
        "nationalApp": d["app"],
        "cityNotes": [{"city": k, "note": v, "reviewTier": "unverified"} for k, v in d["cities"].items()],
        "sourceUrls": [d["url"]],
        "lastVerifiedOn": DATE, "verifiedBy": TAG,
        "notes": (d["notes"] + " " if d["notes"] else "") + GEN,
    }
    json.dump(rec, open(path, "w"), indent=2, ensure_ascii=False); open(path, "a").write("\n")
    written.append(cc)

# authorities: add any country missing from the list
auth = json.load(open(AUTH))
have = {a["countryCode"] for a in auth}
for cc, d in C.items():
    if cc not in have:
        auth.append({"countryCode": cc, "name": d["name"], "authorityName": d["auth"], "authorityUrl": d["url"], "region": REGION.get(cc, "")})
auth.sort(key=lambda a: a["countryCode"])
json.dump(auth, open(AUTH, "w"), indent=2, ensure_ascii=False); open(AUTH, "a").write("\n")

# registry: every json in the folder
files = sorted(f[:-5] for f in os.listdir(OUT) if f.endswith(".json") and not f.startswith("_"))
# identifiers are prefixed: "do", "in" and "is" are reserved words
lines = ['import type { CountryRules } from "../rules";', ''] + [f'import r_{cc} from "./{cc}.json";' for cc in files] + [
    '', '// The registry of published country files, in three labelled tiers:',
    '// "verified" (a pilot read the sources and has flown there), "desk-review"',
    '// (official sources read at a desk), and "unverified" (written from general',
    '// knowledge; the authority page is listed to check). Generated by',
    '// scripts/fieldbrief/unverified-countries.py for the third tier; the other',
    '// two are edited by hand. tests/fieldbrief-rules.test.ts keeps the folder and',
    '// this list in agreement.',
    'export const RULE_FILES: Record<string, CountryRules> = {'] + [f'  {cc.upper()}: r_{cc} as unknown as CountryRules,' for cc in files] + ['};', '']
open(os.path.join(OUT, "index.ts"), "w").write("\n".join(lines))
print(f"wrote {len(written)} unverified records, kept {len(skipped)} existing (city notes added where missing), {len(files)} registered, {len(auth)} authorities")
