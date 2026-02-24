import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function AdminHowItWorks() {
  return (
    <div className="mx-auto max-w-4xl space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">How This Works</h1>
        <p className="mt-1 text-sm text-gray-500">
          Super Admin guide — system-wide management and platform overview.
        </p>
      </div>

      {/* Overview */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Platform Overview</CardTitle>
        </CardHeader>
        <CardContent className="prose prose-sm max-w-none text-gray-700">
          <p>
            Project 803 is an AI-Moderated Debate Platform. Professors create
            debate assignments, students upload memos, get paired by an AI
            matchmaking algorithm, and participate in structured ~13-minute
            real-time video debates moderated by AI. The system automatically
            scores each student and generates narrative summaries.
          </p>
          <p>
            As a <strong>Super Admin</strong>, you manage the institutional
            layer: classes, professor accounts, and system-wide monitoring. You
            also have full access to all professor features.
          </p>
        </CardContent>
      </Card>

      {/* What You Can Do */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Admin-Only Features</CardTitle>
        </CardHeader>
        <CardContent className="space-y-5 text-sm text-gray-700">
          <div>
            <h3 className="font-semibold text-gray-900">Classes</h3>
            <p className="mt-1">
              Create and manage classes (e.g., &ldquo;ECON 803&rdquo;). Each class has a
              unique code and optional description. You can:
            </p>
            <ul className="mt-2 ml-4 list-disc space-y-1">
              <li>Create new classes with name, code, and description</li>
              <li>Search and add users (professors or students) to a class</li>
              <li>Remove members from a class</li>
              <li>View member count, roles, emails, and join dates</li>
            </ul>
            <p className="mt-2">
              When a professor creates an assignment linked to a class, students
              who sign up are automatically added to that class.
            </p>
          </div>

          <div>
            <h3 className="font-semibold text-gray-900">Professors</h3>
            <p className="mt-1">
              Create professor accounts so they can log in and manage their own
              assignments. Each professor needs a name, email, and password.
              Professors can only see assignments they created.
            </p>
          </div>

          <div>
            <h3 className="font-semibold text-gray-900">System-Wide Costs</h3>
            <p className="mt-1">
              The Costs page shows AI usage across <strong>all</strong> professors
              and assignments — not just your own. See total spend, per-service
              breakdown (Claude API vs Deepgram transcription), and drill into
              costs per assignment and call type.
            </p>
          </div>

          <div>
            <h3 className="font-semibold text-gray-900">Dashboard</h3>
            <p className="mt-1">
              High-level metrics: total number of classes, professors, and
              students across the entire system.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Professor Features */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Professor Features (Also Available to You)</CardTitle>
        </CardHeader>
        <CardContent className="space-y-5 text-sm text-gray-700">
          <p>
            Click <strong>Professor View</strong> in the sidebar to access all
            professor features. Here&apos;s the full workflow professors use:
          </p>

          <div>
            <h3 className="font-semibold text-gray-900">1. Create Assignment</h3>
            <p className="mt-1">
              Title, prompt, optional rubric criteria (up to 10 weighted criteria),
              reading links, deadlines (memo and debate), student access controls
              (email domain and/or access code). Assignments can be linked to a
              class.
            </p>
          </div>

          <div>
            <h3 className="font-semibold text-gray-900">2. Students Sign Up &amp; Upload Memos</h3>
            <p className="mt-1">
              Students use the assignment&apos;s signup link, verify their email with a
              6-digit code, and optionally set their weekly availability. They then
              upload a PDF memo. The system extracts text and uses Claude to
              analyze: position, thesis, key claims, stance strength, and reading
              citations. Students confirm or flag the AI-detected position.
            </p>
          </div>

          <div>
            <h3 className="font-semibold text-gray-900">3. AI Pairing</h3>
            <p className="mt-1">
              Claude Sonnet analyzes all memos and creates optimal pairings based
              on argument divergence, reading overlap, and student availability.
              Each pair gets a private video room.
            </p>
          </div>

          <div>
            <h3 className="font-semibold text-gray-900">4. Debate (~13 min)</h3>
            <p className="mt-1">
              Structured phases: Opening (2 min each) → Cross-Exam (3 min each) →
              Rebuttal (1 min each) → Closing (30 sec each). AI moderator listens
              live via Deepgram, prompts for citations, fact-checks against
              readings, and nudges silent students. Students can add +1 minute or
              skip ahead.
            </p>
          </div>

          <div>
            <h3 className="font-semibold text-gray-900">5. Auto-Evaluation</h3>
            <p className="mt-1">
              Claude Sonnet scores each student against the rubric using the debate
              transcript and memo as inputs. Produces per-criteria scores with
              reasoning, pass/fail, integrity flags, and a narrative summary.
            </p>
          </div>

          <div>
            <h3 className="font-semibold text-gray-900">6. Review &amp; Export</h3>
            <p className="mt-1">
              Professors see results on the assignment page: side-by-side debate
              evaluations, student profiles with full transcripts, and CSV export
              of all scores.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Architecture */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">System Architecture</CardTitle>
        </CardHeader>
        <CardContent>
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b text-xs text-gray-500">
                <th className="pb-2 pr-4">Service</th>
                <th className="pb-2 pr-4">Port</th>
                <th className="pb-2">What It Does</th>
              </tr>
            </thead>
            <tbody className="text-gray-700">
              <tr className="border-b border-gray-100"><td className="py-2 pr-4 font-medium">Next.js</td><td className="pr-4">3000</td><td>Web app, API routes, authentication</td></tr>
              <tr className="border-b border-gray-100"><td className="py-2 pr-4 font-medium">Memo Processor</td><td className="pr-4">8001</td><td>PDF text extraction + Claude analysis of student memos</td></tr>
              <tr className="border-b border-gray-100"><td className="py-2 pr-4 font-medium">Debate Moderator</td><td className="pr-4">8004</td><td>WebSocket server, Deepgram STT, Claude real-time moderation</td></tr>
              <tr className="border-b border-gray-100"><td className="py-2 pr-4 font-medium">Evaluator</td><td className="pr-4">8005</td><td>Claude Sonnet scoring + narrative summary generation</td></tr>
              <tr className="border-b border-gray-100"><td className="py-2 pr-4 font-medium">PostgreSQL</td><td className="pr-4">5432</td><td>All data storage (users, assignments, memos, debates, evaluations)</td></tr>
              <tr><td className="py-2 pr-4 font-medium">Daily.co</td><td className="pr-4">—</td><td>Video/audio rooms for debates</td></tr>
            </tbody>
          </table>
        </CardContent>
      </Card>

      {/* AI Models */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">AI Models &amp; Costs</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-gray-700">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b text-xs text-gray-500">
                <th className="pb-2 pr-4">Task</th>
                <th className="pb-2 pr-4">Model</th>
                <th className="pb-2">Approx. Cost</th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-b border-gray-100"><td className="py-2 pr-4 font-medium">Memo Analysis</td><td className="pr-4">Claude Haiku</td><td>~$0.01 per memo</td></tr>
              <tr className="border-b border-gray-100"><td className="py-2 pr-4 font-medium">Pairing</td><td className="pr-4">Claude Sonnet</td><td>~$0.05 per batch</td></tr>
              <tr className="border-b border-gray-100"><td className="py-2 pr-4 font-medium">Live Moderation</td><td className="pr-4">Claude Haiku</td><td>~$0.10–$0.30 per debate</td></tr>
              <tr className="border-b border-gray-100"><td className="py-2 pr-4 font-medium">Evaluation</td><td className="pr-4">Claude Sonnet</td><td>~$0.10–$0.20 per student</td></tr>
              <tr className="border-b border-gray-100"><td className="py-2 pr-4 font-medium">Debrief</td><td className="pr-4">Claude Haiku</td><td>~$0.01 per student</td></tr>
              <tr><td className="py-2 pr-4 font-medium">Transcription</td><td className="pr-4">Deepgram Nova-3</td><td>~$0.30 per debate (~13 min)</td></tr>
            </tbody>
          </table>
          <p className="text-xs text-gray-500">
            Rough estimate: $0.50–$1.50 total per debate (both students).
            Monitor actual costs on the Costs page.
          </p>
        </CardContent>
      </Card>

      {/* Role Differences */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Role Permissions</CardTitle>
        </CardHeader>
        <CardContent>
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b text-xs text-gray-500">
                <th className="pb-2 pr-4">Feature</th>
                <th className="pb-2 pr-4 text-center">Student</th>
                <th className="pb-2 pr-4 text-center">Professor</th>
                <th className="pb-2 text-center">Super Admin</th>
              </tr>
            </thead>
            <tbody className="text-gray-700">
              <tr className="border-b border-gray-100">
                <td className="py-1.5 pr-4">Upload memos &amp; debate</td>
                <td className="pr-4 text-center">Yes</td><td className="pr-4 text-center">—</td><td className="text-center">—</td>
              </tr>
              <tr className="border-b border-gray-100">
                <td className="py-1.5 pr-4">Create assignments</td>
                <td className="pr-4 text-center">—</td><td className="pr-4 text-center">Yes</td><td className="text-center">Yes</td>
              </tr>
              <tr className="border-b border-gray-100">
                <td className="py-1.5 pr-4">Generate pairings &amp; send invitations</td>
                <td className="pr-4 text-center">—</td><td className="pr-4 text-center">Yes</td><td className="text-center">Yes</td>
              </tr>
              <tr className="border-b border-gray-100">
                <td className="py-1.5 pr-4">Review evaluations &amp; transcripts</td>
                <td className="pr-4 text-center">—</td><td className="pr-4 text-center">Yes</td><td className="text-center">Yes</td>
              </tr>
              <tr className="border-b border-gray-100">
                <td className="py-1.5 pr-4">Impersonate students</td>
                <td className="pr-4 text-center">—</td><td className="pr-4 text-center">Yes</td><td className="text-center">Yes</td>
              </tr>
              <tr className="border-b border-gray-100">
                <td className="py-1.5 pr-4">Manage classes &amp; memberships</td>
                <td className="pr-4 text-center">—</td><td className="pr-4 text-center">—</td><td className="text-center">Yes</td>
              </tr>
              <tr className="border-b border-gray-100">
                <td className="py-1.5 pr-4">Create professor accounts</td>
                <td className="pr-4 text-center">—</td><td className="pr-4 text-center">—</td><td className="text-center">Yes</td>
              </tr>
              <tr>
                <td className="py-1.5 pr-4">View system-wide costs</td>
                <td className="pr-4 text-center">—</td><td className="pr-4 text-center">Own only</td><td className="text-center">All</td>
              </tr>
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}
