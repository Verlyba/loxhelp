# Product Requirements Document (PRD)

## 1. Cil projektu & Prehled

Cilem je implementovat a plne pokryt spravu klicovych entit vzdelavaciho systemu (LMS). Vsechny nize definovane funkce musi byt implementovany robustne, s napojenim na databazi, plnou synchronizaci s uzivatelskym uctem a kontrolou pristupovych prav (RBAC) pri zachovani soucasneho vizualniho stylu a optimalizace vykonu.

---

## 2. Funkcni pozadavky (Rozsah systemu)

Aplikace musi obsahovat plnohodnotnou spravu pro nasledujici moduly:

- **Sprava trid**
- **Sprava zaku**
- **Sprava predmetu**
- **Sprava materialu**
- **Sprava skupin**
- **Sprava ukolu**
- **Sprava testu**

### Globalni matice akci pro kazdy modul:

Kazdy z vyse uvedenych modulu musi bezvyhradne splnovat tato kriteria:

1.  **Dohledatelnost:** Moznost entitu v systemu vyhledat / filtrovat.
2.  **Zobrazeni:** Detailni nahled na entitu a jeji pridruzena data.
3.  **Rizeni opravneni (RBAC):** Akce se odvijeji od role prihlaseneho uzivatele (Admin, Ucitel, Student).
4.  **Kompletni CRUD cyklus (pro uzivatele s opravnenim):**
    - Pridavani novych zaznamu (Create)
    - Uprava existujicich zaznamu (Update)
    - Mazani zaznamu (Delete) - vzdy s kaskadovym osetrenim dat (napr. smazani adresare s prilohami).

---

## 3. Datova architektura a Objekty

Tvym ukolem jako agenta je teoreticky i prakticky rozdelit prvky v databazi na samostatne objekty.

### Pozadovane chovani pro objekty:

- **Definice entit:** Navrhni/dopln vlastnosti, atributy a datove typy pro objekty: _Predmety, Tridy, Skupiny, Zaci, Materialy, Ukoly, Testy_ (a pripadne dalsi spojovaci tabulky).
- **Interakce a relace:** Jasne definuj vazby mezi objekty (napr. Zak <-> Trida, Skupina <-> Predmet, Ukol <-> Trida).
- **Vizualizace propojeni:** Jakekoliv datove propojeni mezi objekty musi byt pro uzivatele s prislusnym opravnenim v aplikaci viditelne a klikatelne (napr. z karty zaka se prokliknout na jeho tridu/skupinu).

---

## 4. UI/UX a Rozhrani stranek

Kazdy definovany objekt musi mit v aplikaci dedikovane uzivatelske rozhrani:

- **Vlastni karty / dedikovane stranky:** Kazdy objekt (napr. konkretni Trida, konkretni Zak) ma svou prehlednou profilovou kartu nebo samostatnou podstranku.
- **Konzistence a Styl:** Vsechny tyto stranky musi striktne dodrzovat stavajici vizualni styl aplikace (Tailwind tridy, komponenty, dark/light mode, eliminace nativnich alertu/confirmu za jednotny dialogovy system).
- **Mobilni optimalizace:** Rozhrani musi byt plne responzivni. Ucitele typicky spravuji data z desktopu, ale studenti ke kurzum, ukolum a znamkam pristupuji primarne z mobilnich telefonu.

---

## 5. Pokrocile kontextove pozadavky (LMS Logika)

### A. Zivotni cyklus obsahu (Draft vs. Published)

- Materialy, ukoly a testy musi podporovat stav `koncept (draft)` a `zverejneno (published)`.
- Ucitel musi mit moznost obsah pripravit dopredu, aniz by ho studenti videli. Student vidi pouze polozky ve stavu `published`.

### B. Pravni kryti ucitele a evidence souhlasu

- System musi umoznovat u specifickych ukolu/projektu vyzadovat **digitalni potvrzeni ze strany studenta** (napr. "Byl jsem seznamen s podminkami zadani, kriterii hodnoceni a vybral jsem si variantu X").
- Tento souhlas musi byt v databazi pevne zalogovan (timestamp, ID uzivatele), aby slouzil jako prokazatelny podklad pro ucitele v pripade naslednych sporu s rodici nebo vedenim skoly.

### C. Audit Log (Historie kritickych zmen)

- Jakakoliv zmena klasifikace (zapis znamky, prepsani znamky, smazani znamky) nebo zmena stavu odevzdani ukolu musi zanechat stopu v tabulce `AuditLog` (kdo zmenu provedl, kdy, puvodni hodnota, nova hodnota).

### D. Hromadne operace a Integrace dat

- **Importy:** System musi byt pripraven na hromadny import studentu a trid (napr. parsovanim standardniho CSV/XLSX exportu ze skolnich matrik jako Bakalari/SkolaOnLine).
- **Transakcni bezpecnost:** Veskere hromadne zapisy (zapis znamek skupine, importy) musi bezet v databazove transakci. Pokud selze jeden zapis, nepropise se nic.

---

## 6. Aktualni cil pro Ralph Loop

1. Zanalyzovat stavajici databazove schema a navrhnout chybejici atributy/relace pro objekty vyse vcetne stavu (draft/published), audit logu a evidence souhlasu.
2. Vytvorit/upravit backendove routy/RPC funkce pro kompletni CRUD operace s kontrolou roli.
3. Implementovat/upravit frontendove stranky a karty pro jednotlive objekty podle globalni matice akci a zajistit responzivitu pro zobrazeni studentum.
