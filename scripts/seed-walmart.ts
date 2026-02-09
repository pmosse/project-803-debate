import postgres from "postgres";
import bcrypt from "bcryptjs";
import * as dotenv from "dotenv";

dotenv.config({ path: "../app/.env.local" });

const connectionString =
  process.env.DATABASE_URL || "postgresql://debates:debates@localhost:5433/debates";
const client = postgres(connectionString);

async function seed() {
  console.log("Seeding Walmart case study...\n");

  // Enable pgvector
  await client`CREATE EXTENSION IF NOT EXISTS vector`;

  // Clean existing data (in reverse FK order)
  await client`DELETE FROM evaluations`;
  await client`DELETE FROM debate_sessions`;
  await client`DELETE FROM pairings`;
  await client`DELETE FROM memos`;
  await client`DELETE FROM reading_chunks`;
  await client`DELETE FROM assignments`;
  await client`DELETE FROM users`;
  console.log("Cleared existing data.");

  // Create instructor
  const passwordHash = await bcrypt.hash("instructor123", 10);
  const [instructor] = await client`
    INSERT INTO users (name, email, role, course_code, password_hash)
    VALUES ('Professor Smith', 'smith@columbia.edu', 'instructor', 'ECON803', ${passwordHash})
    RETURNING id
  `;
  console.log(`Instructor: Professor Smith (${instructor.id})`);

  // Create students (all use password "student123")
  const studentPasswordHash = await bcrypt.hash("student123", 10);
  const studentRoster = [
    { name: "Patricio Gonzalez", email: "pg2677@columbia.edu" },
    { name: "Alice Johnson", email: "aj3045@columbia.edu" },
    { name: "Bob Williams", email: "bw2198@columbia.edu" },
    { name: "Carol Davis", email: "cd2876@columbia.edu" },
    { name: "David Brown", email: "db3012@columbia.edu" },
    { name: "Eve Martinez", email: "em2754@columbia.edu" },
    { name: "Frank Wilson", email: "fw2431@columbia.edu" },
    { name: "Grace Lee", email: "gl2589@columbia.edu" },
    { name: "Henry Chen", email: "hc2967@columbia.edu" },
    { name: "Isabella Torres", email: "it2643@columbia.edu" },
    { name: "James Kim", email: "jk3108@columbia.edu" },
    { name: "Katherine Patel", email: "kp2815@columbia.edu" },
    { name: "Lucas Andersen", email: "la2790@columbia.edu" },
  ];

  const students: { id: string; name: string }[] = [];
  for (const { name, email } of studentRoster) {
    const [s] = await client`
      INSERT INTO users (name, email, role, course_code, password_hash)
      VALUES (${name}, ${email}, 'student', 'ECON803', ${studentPasswordHash})
      RETURNING id, name
    `;
    students.push(s);
  }
  console.log(`Created ${students.length} students on the roster.\n`);

  // Create assignment
  const promptText = `WEEK 2: Scale-Ups vs SMEs

Which of these creates more jobs and more GDP growth? Why do we talk so much about startups? This class offers a top-down vision of how entrepreneurs can have an economic impact that moves the needle. Which is better for a country like the US: One Walmart Corporation or 2-million independent self-employed retail entrepreneurs?

Assignment: One page response to the question: Should Walmart get the Nobel in Economics, in Peace, both, or burn in hell?`;

  const rubricText = `Students will be evaluated on:
1. Clarity of thesis and position (20%)
2. Use of evidence from assigned readings (30%)
3. Quality of argument structure (20%)
4. Engagement with counterarguments during debate (20%)
5. Accuracy of claims relative to the readings (10%)`;

  const readingLinks = JSON.stringify([
    {
      title: 'Basker (2005) — "Job Creation or Destruction? Labor Market Effects of Wal-Mart Expansion"',
      url: "https://www.jstor.org/stable/40042879",
    },
    {
      title: 'Neumark, Zhang & Ciccarella (2008) — "The effects of Wal-Mart on local labor markets"',
      url: "https://www.sciencedirect.com/science/article/pii/S0094119007000629",
    },
    {
      title: 'Isenberg & Fabre (2014) — "Don\'t Judge The Economy By The Number Of Startups" (HBR)',
      url: "https://hbr.org/2014/05/dont-judge-the-economy-by-the-number-of-startups",
    },
  ]);

  const memoDeadline = new Date();
  memoDeadline.setDate(memoDeadline.getDate() + 7);
  const debateDeadline = new Date();
  debateDeadline.setDate(debateDeadline.getDate() + 14);

  const [assignment] = await client`
    INSERT INTO assignments (title, prompt_text, rubric_text, reading_links, memo_deadline, debate_deadline, course_code, created_by)
    VALUES ('Walmart Case', ${promptText}, ${rubricText}, ${readingLinks}::jsonb, ${memoDeadline.toISOString()}, ${debateDeadline.toISOString()}, 'ECON803', ${instructor.id})
    RETURNING id
  `;
  console.log(`Assignment: Walmart Case (${assignment.id})\n`);

  // Create analyzed memos for most students
  const memoData: { studentIndex: number; position: string; thesis: string; claims: string[]; strength: string }[] = [
    {
      studentIndex: 0, // Patricio
      position: "net_positive",
      thesis: "Walmart's scale creates net economic value through lower consumer prices and job creation that outweighs displacement effects.",
      claims: [
        "Basker (2005) shows Walmart creates 100 net new retail jobs per store in the first year",
        "Consumer savings of $263 billion annually benefit low-income families disproportionately",
        "Walmart's supply chain efficiency drives down costs across the entire retail sector",
      ],
      strength: "strong",
    },
    {
      studentIndex: 1, // Alice
      position: "net_negative",
      thesis: "Walmart's expansion systematically destroys small businesses and depresses wages, creating a net negative economic impact.",
      claims: [
        "Neumark et al. (2008) find that Walmart reduces retail employment by 2-4% in affected counties",
        "Walmart workers earn 12% less than comparable retail employees",
        "Small business closures reduce local tax revenue and community investment",
      ],
      strength: "strong",
    },
    {
      studentIndex: 2, // Bob
      position: "net_positive",
      thesis: "The scale-up model represented by Walmart creates more GDP growth than equivalent small businesses.",
      claims: [
        "Isenberg & Fabre argue we overvalue startups versus proven scale-ups",
        "Walmart employs 2.1 million people with benefits unavailable to most small retailers",
        "Productivity gains from Walmart-style operations benefit the broader economy",
      ],
      strength: "moderate",
    },
    {
      studentIndex: 3, // Carol
      position: "net_negative",
      thesis: "Walmart should 'burn in hell' for its systematic suppression of wages and destruction of local retail ecosystems.",
      claims: [
        "Neumark shows a race to the bottom in wages wherever Walmart enters",
        "Community destruction goes beyond economics — loss of local character",
        "Basker's job creation numbers don't account for long-term displacement effects",
      ],
      strength: "strong",
    },
    {
      studentIndex: 4, // David
      position: "net_positive",
      thesis: "Walmart deserves recognition for lifting millions out of poverty through lower prices.",
      claims: [
        "Basker's data shows net job creation despite displacement",
        "Lower food prices from Walmart save the average family $2,500/year",
        "Rural communities gain access to goods previously unavailable",
      ],
      strength: "moderate",
    },
    {
      studentIndex: 5, // Eve
      position: "net_negative",
      thesis: "The long-term damage to local economies from Walmart's monopolistic practices outweighs short-term consumer savings.",
      claims: [
        "Predatory pricing destroys competition, then prices can rise",
        "Neumark et al. document significant wage depression effects",
        "Government subsidies to underpaid Walmart workers cost taxpayers billions",
      ],
      strength: "moderate",
    },
    {
      studentIndex: 6, // Frank
      position: "net_positive",
      thesis: "One Walmart creates more economic value than 2 million independent retailers through superior efficiency.",
      claims: [
        "Supply chain innovation drives economy-wide productivity improvements",
        "Isenberg argues scale is undervalued in economic impact discussions",
        "Walmart's logistics network is itself a massive job creator",
      ],
      strength: "weak",
    },
    {
      studentIndex: 7, // Grace
      position: "net_negative",
      thesis: "Walmart's labor practices make it undeserving of any Nobel recognition.",
      claims: [
        "Systemic union suppression documented across the company",
        "Worker injuries and insufficient healthcare coverage",
        "Neumark shows the wage effect extends beyond direct Walmart employees",
      ],
      strength: "strong",
    },
    {
      studentIndex: 8, // Henry
      position: "net_positive",
      thesis: "Walmart's contribution to economic efficiency and consumer welfare warrants Nobel consideration in Economics.",
      claims: [
        "Basker demonstrates clear net job creation in initial years",
        "Consumer surplus from lower prices is an unambiguous economic benefit",
        "Walmart pioneered logistical innovations adopted across industries",
      ],
      strength: "strong",
    },
    {
      studentIndex: 9, // Isabella
      position: "net_negative",
      thesis: "The social costs of Walmart's model — wage depression, community erosion — far exceed any efficiency gains.",
      claims: [
        "Communities with Walmart see increased poverty rates per Neumark",
        "The 'Walmart effect' on wages persists for years after entry",
        "Environmental costs of Walmart's logistics network are externalized",
      ],
      strength: "moderate",
    },
    {
      studentIndex: 10, // James — uploaded but not yet analyzed
      position: "net_positive",
      thesis: "",
      claims: [],
      strength: "moderate",
    },
  ];

  for (const memo of memoData) {
    const student = students[memo.studentIndex];
    const isAnalyzed = memo.thesis !== "";

    const analysis = isAnalyzed
      ? JSON.stringify({
          position: memo.position,
          thesis: memo.thesis,
          key_claims: memo.claims,
          citations: memo.claims.map((c) => ({
            reading: c.split("(")[0]?.trim() || "Unknown",
            how_used: c,
          })),
          stance_strength: memo.strength,
          reasoning: `Student argues a ${memo.position.replace("_", " ")} position with ${memo.strength} conviction.`,
        })
      : null;

    await client`
      INSERT INTO memos (assignment_id, student_id, file_path, extracted_text, analysis, position_binary, student_confirmed, status, analyzed_at)
      VALUES (
        ${assignment.id},
        ${student.id},
        ${`memos/${assignment.id}/${student.id}/memo.pdf`},
        ${isAnalyzed ? `[Extracted text for ${student.name}'s memo on ${memo.position}]` : null},
        ${analysis}::jsonb,
        ${isAnalyzed ? memo.position : "unclassified"},
        ${isAnalyzed ? 1 : 0},
        ${isAnalyzed ? "analyzed" : "uploaded"},
        ${isAnalyzed ? new Date().toISOString() : null}
      )
    `;

    const status = isAnalyzed ? `analyzed (${memo.position})` : "uploaded (processing)";
    console.log(`  Memo: ${student.name} — ${status}`);
  }

  // Students 11-12 (Katherine, Lucas) have no memo yet
  console.log(`  ${students[11].name} — no memo`);
  console.log(`  ${students[12].name} — no memo`);

  console.log(`\nSeeded ${memoData.length} memos (${memoData.filter((m) => m.thesis).length} analyzed, 1 processing, 2 students haven't uploaded yet).`);

  console.log("\n--- Login Credentials ---");
  console.log("Instructor: smith@columbia.edu / instructor123");
  console.log("Students (all use password: student123):");
  for (const roster of studentRoster) {
    console.log(`  - ${roster.email} (${roster.name})`);
  }
  console.log("\nSeed complete!");

  await client.end();
}

seed().catch(console.error);
