import { mkdirSync, writeFileSync, copyFileSync, statSync, existsSync } from "node:fs";
import { dirname, resolve, join } from "node:path";
import { db } from "../src/lib/db";
import { hashPassword } from "../src/lib/password";

/**
 * Seeds a realistic starting state: staff + students, one class with two
 * themed subjects, enrollments, assignments (incl. an overdue one), groups and
 * one example submission with a real file on disk so download works.
 *
 * Loxone subject pages are based on the real Moodle course "Loxone praxe 2EB 25/26".
 * Files are copied from the provided moodle_content directory and linked dynamically.
 *
 * Re-runnable: wipes the tables it owns first. Run with `bun run db:seed`.
 */

const PASSWORD = "heslo123"; // demo password for every seeded account
const MOODLE_DIR = resolve(process.cwd(), "moodle_content/Course_activities_Loxone_praxe_2EB_2526__Stedn_prmyslov_kola_na_Proseku");
const TARGET_FILES_DIR = "course_files";

function getMimeType(fileName: string): string {
  const ext = fileName.split(".").pop()?.toLowerCase();
  if (ext === "pdf") return "application/pdf";
  if (ext === "pptx") return "application/vnd.openxmlformats-officedocument.presentationml.presentation";
  if (ext === "docx") return "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
  return "application/octet-stream";
}

async function main() {
  // Clear in FK-safe order.
  await db.submission.deleteMany();
  await db.groupMember.deleteMany();
  await db.group.deleteMany();
  await db.assignment.deleteMany();
  await db.enrollment.deleteMany();
  await db.subjectFile.deleteMany();
  await db.subjectPage.deleteMany();
  await db.subject.deleteMany();
  await db.class.deleteMany();
  await db.session.deleteMany();
  await db.user.deleteMany();

  const pw = hashPassword(PASSWORD);
  const mkUser = (email: string, firstName: string, lastName: string, role: string) =>
    db.user.create({ data: { email, firstName, lastName, role, passwordHash: pw } });

  const admin = await mkUser("admin@school.cz", "Admin", "Školní", "ADMIN");
  const teacher = await mkUser("novak@school.cz", "Jan", "Novák", "TEACHER");

  const anna = await mkUser("anna@school.cz", "Anna", "Nováková", "STUDENT");
  const petr = await mkUser("petr@school.cz", "Petr", "Kovář", "STUDENT");
  const jana = await mkUser("jana@school.cz", "Jana", "Svobodová", "STUDENT");
  const tomas = await mkUser("tomas@school.cz", "Tomáš", "Liška", "STUDENT");
  const marek = await mkUser("marek@school.cz", "Marek", "Veselý", "STUDENT");
  const klara = await mkUser("klara@school.cz", "Klára", "Dvořáková", "STUDENT");
  const honza = await mkUser("honza@school.cz", "Honza", "Fiala", "STUDENT");

  const schoolClass = await db.class.create({
    data: { name: "2.EB", schoolYear: "2025/2026" },
  });

  const loxone = await db.subject.create({
    data: {
      name: "Loxone praxe",
      slug: "loxone",
      description: "Materiály k výuce a certifikaci systému Loxone. Konfigurace Miniserveru, programování a integrace.",
      themeStyle: "loxone",
      classId: schoolClass.id,
    },
  });
  const cad = await db.subject.create({
    data: {
      name: "3D CAD modelování",
      slug: "cad3d",
      description: "Parametrické modelování, sestavy a technické výkresy od základů po pokročilé techniky.",
      themeStyle: "cad3d",
      classId: schoolClass.id,
    },
  });

  // ========================
  //  LOXONE PAGES DEFINITIONS (from Moodle)
  // ========================

  interface SeedFile {
    label: string;
    fileName: string;
    category: "presentation" | "manual" | "schema" | "template" | "material";
    description: string;
  }

  interface SeedPage {
    title: string;
    slug: string;
    template: string;
    content?: string;
    order: number;
    files?: SeedFile[];
  }

  const loxonePages: SeedPage[] = [
    {
      title: "Úvod",
      slug: "uvod",
      template: "content",
      order: 0,
      content: `# Úvod

Vítejte v kurzu **Loxone praxe**. Tento prostor slouží jako ucelené centrum pro všechny studijní podklady, schémata, prezentace a samostatné úkoly.

## Systémové požadavky pro výuku
Pro programování a konfiguraci Miniserveru budeme využívat specializované nástroje.

- **Loxone Config** (pouze pro operační systém Windows)
- **Loxone App** (klientská aplikace dostupná pro Linux, Windows, macOS, Android i iOS)

Doporučujeme si nástroje stáhnout a nainstalovat i na domácí počítače pro snazší vypracování samostatných projektů.`,
    },
    {
      title: "Výuka",
      slug: "vyuka",
      template: "content",
      order: 1,
      content: `# Výuka a organizace roku

V této sekci naleznete organizační informace, plán témat pro aktuální školní rok a schéma rozmístění hardwarových výukových panelů v naší laboratoři.

## Hodnocení známkovaných prací
Vaše výsledná známka se skládá z několika částí s různou váhou:

- **Minitesty** (váha: 10 %) — krátké ověření znalostí na začátku hodin
- **Práce v hodinách a řádné testy** (váha: 30–40 %)
- **Dlouhodobá práce / Projekt** (váha: 30 %) — komplexní návrh automatizace vlastního bydlení

## Klasifikační stupnice
Procentuální úspěšnost v testech odpovídá následujícím známkám:
- **1 (Výborný)**: 100 % – 86 %
- **2 (Chvalitebný)**: 85 % – 75 %
- **3 (Dobrý)**: 74 % – 60 %
- **4 (Dostatečný)**: 59 % – 40 %
- **5 (Nedostatečný)**: méně než 40 %`,
      files: [
        { label: "Harmonogram roku", fileName: "Harmonogram_roku.pdf", category: "material", description: "Harmonogram výuky a podrobný týdenní rozpis učiva pro celkem 38 týdnů školního roku Loxone." },
        { label: "Schéma výukových panelů", fileName: "Schma_-_Vukov_panely.pdf", category: "schema", description: "Zapojení prvků na Miniserveru, schéma laboratoře a rozdělení IP adres výukových panelů 1 až 5." }
      ]
    },
    {
      title: "Moderní instalace",
      slug: "moderni-instalace",
      template: "content",
      order: 2,
      content: `# Moderní instalace v budovách

Na začátku kurzu si představíme základní stavební kameny moderní inteligentní elektroinstalace. Probereme integraci technologií jako:

- **Osvětlení** (scény, stmívání, barvy)
- **Stínění** (ochrana před přehříváním, větrný alarm)
- **Vytápění a klimatizace** (IRC, úsporné režimy)
- **Zabezpečení a přístupy** (NFC, poplachy)
- **Multiroom audio & Smart home management**

Pochopení těchto technologií je nezbytné pro správný návrh a programování logiky celého domu.`,
      files: [
        { label: "Prezentace – Moderní instalace", fileName: "Prezentace_-_Modern_instalace.pptx", category: "presentation", description: "Výklad o integraci osvětlení, stínění, topení, rekuperace, zabezpečení a FVE s ohledem na průkaz PENB." }
      ]
    },
    {
      title: "Úvod do systému Loxone",
      slug: "uvod-do-systemu-loxone",
      template: "content",
      order: 3,
      content: `# Úvod do hardwaru a softwaru Loxone

**Miniserver** je srdcem celého systému. Zpracovává veškeré vstupy z tlačítek a senzorů a na základě programu spíná výstupy (relé, stmívače, ventily).

V této lekci se naučíme:
- Základní zapojení Miniserveru a Extension modulů.
- Rozdíly mezi komunikačními sběrnicemi **LINK, TREE a AIR**.
- První spuštění a orientaci v konfiguračním softwaru **Loxone Config**.
- Vytvoření nového projektu a nahrání programu do Miniserveru.`,
      files: [
        { label: "Prezentace – Miniserver", fileName: "Prezentace_-_Miniserver.pptx", category: "presentation", description: "Rozhraní Miniserveru, sběrnice Link, Tree & Air, napájecí zdroje a princip zpětné kompatibility." },
        { label: "Prezentace – Úvod do systému", fileName: "Prezentace_-_vod_do_systmu_Loxone.pdf", category: "presentation", description: "Technické parametry Miniserveru (digitální/analogové I/O, LAN, SD karta) a propojení s Loxone aplikací." },
        { label: "Manuál – Orientace v Loxone Config", fileName: "Manul_-_Orientace_v_Configu.pdf", category: "manual", description: "Příručka pro plánování projektů, správu verzí softwaru a vyhledávání Miniserverů v místní síti." },
        { label: "Manuál – Založení programu", fileName: "Manul_-_Zaloen_programu.pdf", category: "manual", description: "Návod krok za krokem k vytvoření projektu, připojení k Miniserveru a nastavení výchozího hesla admin." },
        { label: "Manuál – Sběrnice LINK, TREE, AIR", fileName: "Manul_-_LINK_TREE_AIR.pdf", category: "manual", description: "Pravidla a diagnostika zapojení sběrnice LINK (max. 30 extensionů) a sběrnice Tree (max. 50 prvků na větev)." }
      ]
    },
    {
      title: "Osvětlení",
      slug: "osvetleni",
      template: "content",
      order: 4,
      content: `# Řízení osvětlení

Správné osvětlení vytváří atmosféru v domě. V Loxone se pro programování využívá blok **Ovládání osvětlení** (Lighting Controller).

Naučíte se:
- Konfigurovat klasické spínané okruhy i stmívatelné světelné zdroje.
- Vytvářet a upravovat světelné scény (čtení, film, party).
- Nastavit automatiku na základě čidel přítomnosti a intenzity venkovního světla.`,
      files: [
        { label: "Prezentace – Osvětlení", fileName: "Prezentace_-_Osvtlen.pptx", category: "presentation", description: "Varianty osvětlení (spínané, stmívané AC/DC, barevné RGB/CCT), světelné nálady a ovládání Touch tlačítky." },
        { label: "Manuál – Konfigurace osvětlení", fileName: "Manul_-_Osvtlen.pdf", category: "manual", description: "Zapojení a nejdůležitější parametry funkčního bloku Ovládání osvětlení (Off, Touch T5, čidlo jasu, pohyb)." },
        { label: "Schéma zapojení v rodinném domě", fileName: "Schma_-_Osvtlen_v_dom.pdf", category: "schema", description: "Blokové schéma zapojení tlačítek Touch Tree, senzorů přítomnosti a LED světel na sběrnici Tree." }
      ]
    },
    {
      title: "Vytápění",
      slug: "vytapeni",
      template: "content",
      order: 5,
      content: `# Regulace vytápění a klimatu

Loxone umožňuje efektivní zónovou regulaci vytápění (IRC – Intelligent Room Controller). Každá místnost se vytápí na individuální teplotu podle časového plánu a přítomnosti osob.

Probereme:
- Integraci teplovodního a elektrického vytápění.
- Práci s inteligentním regulátorem teploty a termoelektrickými pohony ventilů.
- Výhody prediktivního vytápění s ohledem na setrvačnost systému.`,
      files: [
        { label: "Manuál – Regulace vytápění v praxi", fileName: "Manul_-_Vytpn.pdf", category: "manual", description: "Tříúrovňový manuál pro zónovou regulaci teploty, kotle a termostatických ventilů (Intelligent Room Controller)." }
      ]
    },
    {
      title: "Stínící technika",
      slug: "stinici-technika",
      template: "content",
      order: 6,
      content: `# Automatické stínění

Řízení žaluzií, rolet a markýz pomáhá nejen chránit soukromí, ale především pasivně chladit dům v letních měsících a naopak využívat sluneční svit k dotápění v zimě.

Klíčová témata:
- Nastavení koncových poloh a doby chodu stínění.
- Automatické sledování polohy slunce (autonomní naklápění lamel).
- Bezpečnostní prvky – větrný a mrazový alarm (ochrana před poškozením).`,
      files: [
        { label: "Manuál – Konfigurace stínící techniky", fileName: "Manul_-_Stnc_technika.pdf", category: "manual", description: "Návod k nastavení bloku Automatické žaluzie, časů chodu žaluzií/rolet a automatického stínění podle slunce." }
      ]
    },
    {
      title: "Dlouhodobá práce",
      slug: "dlouhodoba-prace",
      template: "content",
      order: 7,
      content: `# Dlouhodobý projekt kurzu

Hlavním úkolem kurzu je vypracování uceleného projektu automatizace reálného objektu (vašeho bytu nebo rodinného domu).

## Klíčové milníky a odevzdávané části
1. **Půdorys a rozložení prvků** — vytvoření přesného výkresu v CADu / ProfiCADu.
2. **Tabulka komponentů a kalkulace investice** — návrh prvků a výpočet návratnosti.
3. **Konfigurační program** — plně funkční program v Loxone Configu splňující požadavky zadání.

Všechny podrobné požadavky, ceník a doporučenou šablonu zprávy naleznete v souborech níže.`,
      files: [
        { label: "Kompletní zadání projektu", fileName: "Zadn.pdf", category: "template", description: "Oficiální zadání ročníkového projektu (obsah dokumentace, zadání půdorysu, konfigurace a zprávy)." },
        { label: "Doporučená šablona projektu", fileName: "ablona.docx", category: "template", description: "Word šablona pro vypracování textové dokumentace se všemi předepsanými kapitolami." },
        { label: "Ceník komponentů Loxone", fileName: "Cenk_komponent.pdf", category: "material", description: "Aktuální ceník prvků Loxone v CZK s katalogovými SKU čísly pro sestavení rozpočtu a kalkulaci investice." }
      ]
    },
    {
      title: "Pomocné nástroje",
      slug: "pomocne-nastroje",
      template: "content",
      order: 8,
      content: `# Pomocné nástroje a VPN připojení

Pro usnadnění práce na projektu můžete využít vzdálené připojení do školní laboratoře a specializované kreslící nástroje pro tvorbu půdorysů.

## Vzdálené připojení (VPN)
Pokud potřebujete pracovat na školních Miniserverech z domova, postupujte takto:
1. Aktivujte si školní VPN (podrobný návod naleznete v nápovědě Moodle).
2. Připojte se k počítači v laboratoři pomocí Vzdálené plochy na IP: \`10.10x.yyy.prosek.intranet\`.
3. Použijte přihlašovací údaje: \`SPS-PROSEK\\innovaXx24\` (kde x = číslo vašeho PC).

## Tvorba půdorysů v ProfiCADu
Pro rychlé nakreslení půdorysu domu doporučujeme program ProfiCAD. Níže naleznete stručnou příručku k ovládání.`,
      files: [
        { label: "Metodika využití AI a LLM", fileName: "Metodika_pouit_LLM.pdf", category: "material", description: "Metodická pravidla pro bezpečné a smysluplné využití AI (LLM) jako podpůrného nástroje při psaní zprávy." },
        { label: "Příručka pro kreslení v ProfiCADu", fileName: "Manul_-_ProfiCAD.pdf", category: "manual", description: "Krok za krokem návod pro kreslení stavebních půdorysů a nastavení výkresů v programu ProfiCAD." }
      ]
    },
    {
      title: "Odevzdání",
      slug: "odevzdani",
      template: "content",
      order: 9,
      content: `# Termíny průběžného odevzdávání

Pro zajištění plynulého postupu prací na projektu je nutné odevzdávat rozpracované části v následujících termínech. Pozdní odevzdání je hodnoceno známkou 5.

## Plán termínů (školní rok 2025/2026)
- **Návrh osvětlení + Půdorys objektu** — odevzdání do **1. 3. 2026**
- **Konfigurace vytápění a regulace** — odevzdání do **15. 3. 2026**
- **Automatické stínění a žaluzie** — odevzdání do **17. 5. 2026**
- **Ostatní technologie (Přístup, audio, rozvaděč)** — odevzdání do **konce května 2026**

*Finální prezentace a obhajoba proběhne osobně před komisí na konci školního roku.*`,
    },
    {
      title: "Minitesty",
      slug: "minitesty",
      template: "content",
      order: 10,
      content: `# Průběžné minitesty

Minitesty jsou psány na začátku vybraných cvičebních hodin a slouží jako rychlá zpětná vazba pro vás i vyučujícího.

## Témata minitestů
1. **Minitest 1** — Hardware Miniserveru a základní kabeláž.
2. **Minitest 2** — Logické vazby a spínání osvětlení.
3. **Minitest 3** — Regulace pokojové teploty a integrace ventilů.
4. **Minitest 4** — Pokročilé kombinované scény (osvětlení, topení a stínění dohromady).`,
    },
    {
      title: "Testy",
      slug: "testy",
      template: "content",
      order: 11,
      content: `# Hlavní kontrolní testy

V průběhu školního roku jsou naplánovány dva hlavní teoreticko-praktické testy:

- **Pololetní test** — zaměřený na hardwarové zapojení, sběrnice a konfiguraci základního spínání.
- **Závěrečný test** — komplexní test pokrývající všechna témata včetně zónové regulace a pokročilé automatiky stínění.`,
    },
    {
      title: "Samostatné práce",
      slug: "samostatne-prace",
      template: "assignments",
      order: 12,
      content: "",
      files: [
        { label: "Zadání SP – Osvětlení (PDF)", fileName: "SP_-_Osvtlen.pdf", category: "template", description: "Zadání samostatné práce na konfiguraci osvětlení (3 scény, Touch Tree, senzor přítomnosti) pro klienta Jana Nováka." }
      ]
    },
  ];

  for (const p of loxonePages) {
    const page = await db.subjectPage.create({
      data: {
        subjectId: loxone.id,
        title: p.title,
        slug: p.slug,
        template: p.template,
        content: p.content ?? "",
        order: p.order,
      },
    });

    // Handle files copying and creation
    if (p.files && p.files.length > 0) {
      for (let i = 0; i < p.files.length; i++) {
        const fileInfo = p.files[i];
        const sourcePath = join(MOODLE_DIR, fileInfo.fileName);

        if (existsSync(sourcePath)) {
          const pageDir = resolve(process.cwd(), TARGET_FILES_DIR, page.id);
          mkdirSync(pageDir, { recursive: true });

          const targetFileName = fileInfo.fileName;
          const targetPath = join(pageDir, targetFileName);
          const relativeKey = `${TARGET_FILES_DIR}/${page.id}/${targetFileName}`;

          copyFileSync(sourcePath, targetPath);
          const stats = statSync(targetPath);

          await db.subjectFile.create({
            data: {
              pageId: page.id,
              label: fileInfo.label,
              fileName: fileInfo.fileName,
              fileKey: relativeKey,
              fileSize: stats.size,
              mimeType: getMimeType(fileInfo.fileName),
              category: fileInfo.category,
              order: i,
            },
          });
        } else {
          console.warn(`Warning: Moodle source file not found: ${sourcePath}`);
        }
      }
    }
  }

  // ========================
  //  CAD PAGES (same structure, different content)
  // ========================

  const cadPages: SeedPage[] = [
    {
      title: "Úvod",
      slug: "uvod",
      template: "content",
      order: 0,
      content: `# Vítejte v předmětu 3D CAD modelování

Parametrické modelování, sestavy a technické výkresy od základů po pokročilé techniky.

## Software

- Autodesk Inventor / Fusion (školní licence)
- Export do STEP pro odevzdání

## Pravidla

- Modely odevzdávejte jako ZIP se zdrojovými soubory i exportem.
- Každá odevzdaná verze musí mít poznámku, co se změnilo.`,
    },
    {
      title: "Materiály",
      slug: "materialy",
      template: "content",
      order: 1,
      content: `# Studijní materiály

V této sekci naleznete příručky, odkazy na dokumentaci a užitečná videa z výukových lekcí 3D CAD modelování.`,
    },
    {
      title: "Úkoly",
      slug: "ukoly",
      template: "assignments",
      order: 2,
    },
  ];

  for (const p of cadPages) {
    await db.subjectPage.create({
      data: {
        subjectId: cad.id,
        title: p.title,
        slug: p.slug,
        template: p.template,
        content: p.content ?? "",
        order: p.order,
      },
    });
  }

  // Enrollments — students only see subjects they're enrolled in.
  const enroll = (userId: string, subjectId: string) =>
    db.enrollment.create({ data: { userId, subjectId } });
  for (const u of [anna, petr, jana, tomas]) await enroll(u.id, loxone.id);
  for (const u of [marek, klara, honza]) await enroll(u.id, cad.id);

  // Assignments for Loxone — based on Moodle "Samostatné práce" section.
  const a_panel = await db.assignment.create({
    data: {
      title: "Programování celého panelu",
      description:
        "Naprogramujte kompletní panel v učebně – osvětlení, stínění, vytápění a přístupy v jednom programu.",
      dueDate: new Date("2026-06-26T00:00:00Z"),
      subjectId: loxone.id,
    },
  });
  const a_osvetleni = await db.assignment.create({
    data: {
      title: "SP – Osvětlení",
      description:
        "Samostatná práce na téma osvětlení. Naprogramujte funkční bloky pro různé typy svítidel a světelné scény.",
      dueDate: new Date("2026-06-30T21:59:00Z"),
      subjectId: loxone.id,
    },
  });
  const a_nocni = await db.assignment.create({
    data: {
      title: "Noční režim",
      description:
        "Vytvořte noční režim pro domácnost – ztlumení osvětlení, zavření žaluzií, úprava teploty a zabezpečení.",
      dueDate: new Date("2026-01-17T17:00:00Z"),
      subjectId: loxone.id,
    },
  });
  const a_topeni = await db.assignment.create({
    data: {
      title: "Řízení topení v objektu",
      description:
        "Naprogramujte regulaci vytápění pro celý objekt – zonální řízení, IRoomController, teplotní senzory.",
      dueDate: new Date("2025-11-14T17:00:00Z"), // overdue
      subjectId: loxone.id,
    },
  });
  const a_zvoneni = await db.assignment.create({
    data: {
      title: "Noční zvonění",
      description:
        "Nastavte automatické přepínání zvonění v nočních hodinách – ztlumení/vypnutí zvonku podle časového plánu.",
      dueDate: new Date("2026-03-21T16:00:00Z"),
      subjectId: loxone.id,
    },
  });
  const a_zakaznik = await db.assignment.create({
    data: {
      title: "Představení zákazníka – Ochrana garáže před mrazem",
      description:
        "Připravte návrh řešení pro zákazníka: automatická ochrana garáže před mrazem pomocí systému Loxone.",
      dueDate: new Date("2026-07-01T17:00:00Z"),
      subjectId: loxone.id,
    },
  });

  // Assignments for CAD.
  const a3 = await db.assignment.create({
    data: {
      title: "Parametrická konzole — sestava + výkres",
      description:
        "Navrhněte nosnou konzoli, sestavu se dvěma spojovacími prvky a plně okótovaný výkres.",
      dueDate: new Date("2026-07-05T21:59:00Z"),
      subjectId: cad.id,
    },
  });
  const a4 = await db.assignment.create({
    data: {
      title: "Rozpad sestavy + kusovník",
      description:
        "Vytvořte rozpadlý pohled sestavy s pozicemi a vygenerovaný kusovník na výkresovém listu.",
      dueDate: new Date("2026-06-18T21:59:00Z"), // overdue
      subjectId: cad.id,
    },
  });

  // Groups + members.
  const mkGroup = async (name: string, assignmentId: string, memberIds: string[]) => {
    const group = await db.group.create({ data: { name, assignmentId } });
    for (const userId of memberIds) {
      await db.groupMember.create({ data: { groupId: group.id, userId } });
    }
    return group;
  };

  const a1pair1 = await mkGroup("Dvojice 1", a_panel.id, [anna.id, petr.id]);
  await mkGroup("Dvojice 2", a_panel.id, [jana.id, tomas.id]);
  await mkGroup("Dvojice 1", a_osvetleni.id, [anna.id, petr.id]);
  await mkGroup("Dvojice 2", a_osvetleni.id, [jana.id, tomas.id]);
  await mkGroup("Dvojice 1", a_nocni.id, [anna.id, petr.id]);
  await mkGroup("Dvojice 1", a_topeni.id, [anna.id, jana.id]);
  await mkGroup("Dvojice 1", a_zvoneni.id, [petr.id, tomas.id]);
  await mkGroup("Dvojice 1", a_zakaznik.id, [anna.id, petr.id]);
  await mkGroup("Tým A", a3.id, [marek.id, klara.id, honza.id]);
  await mkGroup("Tým A", a4.id, [marek.id, klara.id, honza.id]);

  // One example submission with a real file on disk (so download works).
  const fileKey = "uploads/seed/panel_program_v1.txt";
  const abs = resolve(process.cwd(), fileKey);
  mkdirSync(dirname(abs), { recursive: true });
  const contents = "Seed soubor: programování celého panelu v1 (placeholder pro demonstraci verzování).\n";
  writeFileSync(abs, contents, "utf8");
  await db.submission.create({
    data: {
      version: 1,
      fileName: "panel_program_v1.txt",
      fileKey,
      fileSize: Buffer.byteLength(contents),
      mimeType: "text/plain",
      note: "První návrh zapojení panelu",
      uploadedById: anna.id,
      groupId: a1pair1.id,
    },
  });

  const counts = {
    users: await db.user.count(),
    subjects: await db.subject.count(),
    subjectPages: await db.subjectPage.count(),
    subjectFiles: await db.subjectFile.count(),
    assignments: await db.assignment.count(),
    groups: await db.group.count(),
    submissions: await db.submission.count(),
  };
  console.log("Seed complete:", counts);
  console.log(`All accounts use password: ${PASSWORD}`);
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
