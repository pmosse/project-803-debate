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
  await client`DELETE FROM class_memberships`;
  await client`DELETE FROM classes`;
  await client`DELETE FROM users`;
  console.log("Cleared existing data.");

  // Create super admin
  const adminHash = await bcrypt.hash("admin123", 10);
  const [admin] = await client`
    INSERT INTO users (name, email, role, password_hash)
    VALUES ('System Admin', 'admin@columbia.edu', 'super_admin', ${adminHash})
    RETURNING id
  `;
  console.log(`Super Admin: admin@columbia.edu (${admin.id})`);

  // Create professor
  const passwordHash = await bcrypt.hash("instructor123", 10);
  const [professor] = await client`
    INSERT INTO users (name, email, role, course_code, password_hash)
    VALUES ('Professor Smith', 'smith@columbia.edu', 'professor', 'ECON803', ${passwordHash})
    RETURNING id
  `;
  console.log(`Professor: Professor Smith (${professor.id})`);

  // Create class
  const [classRow] = await client`
    INSERT INTO classes (name, code, description)
    VALUES ('ECON 803', 'ECON803', 'Entrepreneurship and Economic Impact')
    RETURNING id
  `;
  console.log(`Class: ECON 803 (${classRow.id})`);

  // Add professor and admin to class
  await client`
    INSERT INTO class_memberships (user_id, class_id)
    VALUES (${professor.id}, ${classRow.id}), (${admin.id}, ${classRow.id})
  `;

  // Create students (all use password "student123")
  const studentPasswordHash = await bcrypt.hash("student123", 10);
  const studentRoster = [
    { name: "Fernando Fabre", email: "ff2024@columbia.edu" },
    { name: "Patricio Mosse", email: "pm2025@columbia.edu" },
    { name: "Michel Mosse", email: "mm2026@columbia.edu" },
    { name: "Sarah Holloway", email: "sh2027@columbia.edu" },
  ];

  const students: { id: string; name: string }[] = [];
  for (const { name, email } of studentRoster) {
    const [s] = await client`
      INSERT INTO users (name, email, role, course_code, password_hash)
      VALUES (${name}, ${email}, 'student', 'ECON803', ${studentPasswordHash})
      RETURNING id, name
    `;
    students.push(s);

    // Add student to class
    await client`
      INSERT INTO class_memberships (user_id, class_id)
      VALUES (${s.id}, ${classRow.id})
    `;
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
    VALUES ('Walmart Case', ${promptText}, ${rubricText}, ${readingLinks}::jsonb, ${memoDeadline.toISOString()}, ${debateDeadline.toISOString()}, 'ECON803', ${professor.id})
    RETURNING id
  `;
  console.log(`Assignment: Walmart Case (${assignment.id})\n`);

  // Create analyzed memos for all students
  const memoData: { studentIndex: number; position: string; thesis: string; claims: string[]; strength: string }[] = [
    {
      studentIndex: 0, // Fernando Fabre
      position: "net_positive",
      thesis: "Walmart's scale-up model generates far more economic impact than millions of small retailers, and deserves Nobel-level recognition for lifting consumer welfare.",
      claims: [
        "Isenberg & Fabre (2014) argue that scale-ups, not startups, drive real economic growth",
        "Basker (2005) shows Walmart creates 100 net new retail jobs per store in the first year",
        "Consumer savings of $263 billion annually benefit low-income families disproportionately",
      ],
      strength: "strong",
    },
    {
      studentIndex: 1, // Patricio Mosse
      position: "net_negative",
      thesis: "Walmart's expansion systematically destroys small businesses and depresses wages, making it unworthy of any Nobel recognition.",
      claims: [
        "Neumark et al. (2008) find that Walmart reduces retail employment by 2-4% in affected counties",
        "Walmart workers earn 12% less than comparable retail employees",
        "Small business closures reduce local tax revenue and community investment",
      ],
      strength: "strong",
    },
    {
      studentIndex: 2, // Michel Mosse
      position: "net_positive",
      thesis: "Walmart deserves the Nobel in Economics for pioneering supply chain efficiencies that lowered prices and raised living standards for millions.",
      claims: [
        "Basker's data shows net job creation despite short-term displacement",
        "Walmart's logistics innovations have been adopted across the entire retail industry",
        "Lower food prices from Walmart save the average family $2,500/year",
      ],
      strength: "moderate",
    },
    {
      studentIndex: 3, // Sarah Holloway
      position: "net_negative",
      thesis: "The long-term damage to local economies and labor markets from Walmart's monopolistic practices outweighs any consumer savings.",
      claims: [
        "Neumark shows a race to the bottom in wages wherever Walmart enters",
        "Predatory pricing destroys competition, after which prices can rise",
        "Government subsidies to underpaid Walmart workers cost taxpayers billions annually",
      ],
      strength: "strong",
    },
  ];

  for (const memo of memoData) {
    const student = students[memo.studentIndex];
    const analysis = JSON.stringify({
      position: memo.position,
      thesis: memo.thesis,
      key_claims: memo.claims,
      citations: memo.claims.map((c) => ({
        reading: c.split("(")[0]?.trim() || "Unknown",
        how_used: c,
      })),
      stance_strength: memo.strength,
      reasoning: `Student argues a ${memo.position.replace("_", " ")} position with ${memo.strength} conviction.`,
    });

    await client`
      INSERT INTO memos (assignment_id, student_id, file_path, extracted_text, analysis, position_binary, student_confirmed, status, analyzed_at)
      VALUES (
        ${assignment.id},
        ${student.id},
        ${`memos/${assignment.id}/${student.id}/memo.pdf`},
        ${`[Extracted text for ${student.name}'s memo on ${memo.position}]`},
        ${analysis}::jsonb,
        ${memo.position},
        ${1},
        ${"analyzed"},
        ${new Date().toISOString()}
      )
    `;

    console.log(`  Memo: ${student.name} — analyzed (${memo.position})`);
  }

  console.log(`\nSeeded ${memoData.length} memos (all analyzed).`);

  console.log("\n--- Login Credentials ---");
  console.log("Super Admin: admin@columbia.edu / admin123");
  console.log("Professor:   smith@columbia.edu / instructor123");
  console.log("Students (all use password: student123):");
  for (const roster of studentRoster) {
    console.log(`  - ${roster.email} (${roster.name})`);
  }
  console.log("\nSeed complete!");

  await client.end();
}

seed().catch(console.error);
