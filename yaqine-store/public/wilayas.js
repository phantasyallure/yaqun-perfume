/* The 69 wilayas of Algeria (59-69 created in 2025). Stored in orders as "NN - Name (FR)". */
const WILAYAS=[
['Adrar','أدرار'],['Chlef','الشلف'],['Laghouat','الأغواط'],['Oum El Bouaghi','أم البواقي'],['Batna','باتنة'],['Béjaïa','بجاية'],['Biskra','بسكرة'],['Béchar','بشار'],['Blida','البليدة'],['Bouira','البويرة'],
['Tamanrasset','تمنراست'],['Tébessa','تبسة'],['Tlemcen','تلمسان'],['Tiaret','تيارت'],['Tizi Ouzou','تيزي وزو'],['Alger','الجزائر'],['Djelfa','الجلفة'],['Jijel','جيجل'],['Sétif','سطيف'],['Saïda','سعيدة'],
['Skikda','سكيكدة'],['Sidi Bel Abbès','سيدي بلعباس'],['Annaba','عنابة'],['Guelma','قالمة'],['Constantine','قسنطينة'],['Médéa','المدية'],['Mostaganem','مستغانم'],['M\'Sila','المسيلة'],['Mascara','معسكر'],['Ouargla','ورقلة'],
['Oran','وهران'],['El Bayadh','البيض'],['Illizi','إليزي'],['Bordj Bou Arréridj','برج بوعريريج'],['Boumerdès','بومرداس'],['El Tarf','الطارف'],['Tindouf','تندوف'],['Tissemsilt','تيسمسيلت'],['El Oued','الوادي'],['Khenchela','خنشلة'],
['Souk Ahras','سوق أهراس'],['Tipaza','تيبازة'],['Mila','ميلة'],['Aïn Defla','عين الدفلى'],['Naâma','النعامة'],['Aïn Témouchent','عين تموشنت'],['Ghardaïa','غرداية'],['Relizane','غليزان'],['Timimoun','تيميمون'],['Bordj Badji Mokhtar','برج باجي مختار'],
['Ouled Djellal','أولاد جلال'],['Béni Abbès','بني عباس'],['In Salah','عين صالح'],['In Guezzam','عين قزام'],['Touggourt','تقرت'],['Djanet','جانت'],['El M\'Ghair','المغير'],['El Meniaa','المنيعة'],['Aflou','آفلو'],['El Abiodh Sidi Cheikh','الأبيض سيدي الشيخ'],
['El Aricha','العريشة'],['El Kantara','القنطرة'],['Barika','بريكة'],['Bou Saâda','بوسعادة'],['Bir El Ater','بئر العاتر'],['Ksar El Boukhari','قصر البخاري'],['Ksar Chellala','قصر الشلالة'],['Aïn Oussara','عين وسارة'],['Messaad','مسعد']
];
const pad2=n=>String(n).padStart(2,'0');
/* value is always the French label so the admin/Telegram read the same whatever language the customer used */
function wilayaOptions(lang,sel){
  return WILAYAS.map(([fr,ar],i)=>{const v=pad2(i+1)+' - '+fr;return `<option value="${v.replace(/"/g,'&quot;')}"${v===sel?' selected':''}>${pad2(i+1)} - ${lang==='ar'?ar:fr}</option>`}).join('');
}
