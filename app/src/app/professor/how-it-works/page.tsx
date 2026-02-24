import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function ProfessorHowItWorks() {
  return (
    <div className="mx-auto max-w-4xl space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">How This Works</h1>
        <p className="mt-1 text-sm text-gray-500">
          A complete guide to the AI-Moderated Debate Platform for professors.
        </p>
      </div>

      {/* Overview */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Platform Overview</CardTitle>
        </CardHeader>
        <CardContent className="prose prose-sm max-w-none text-gray-700">
          <p>
            Project 803 lets you assign structured oral debates to your students.
            Students upload a written memo, get paired with a classmate by an AI
            matchmaking algorithm, then participate in a ~13-minute real-time
            video debate moderated by an AI. Afterward, the system automatically
            scores each student and generates a narrative summary you can use for
            grading.
          </p>
        </CardContent>
      </Card>

      {/* End-to-End Workflow */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">End-to-End Workflow</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6 text-sm text-gray-700">
          <div>
            <h3 className="font-semibold text-gray-900">1. Create an Assignment</h3>
            <p className="mt-1">
              Go to <strong>New Assignment</strong> in the sidebar. Fill in:
            </p>
            <ul className="mt-2 ml-4 list-disc space-y-1">
              <li><strong>Title &amp; Prompt</strong> — The debate topic and full instructions.</li>
              <li><strong>Rubric</strong> — Up to 10 weighted criteria (e.g., &ldquo;Evidence Use — 20 pts&rdquo;). The AI evaluator scores against these. You can also add free-text rubric notes.</li>
              <li><strong>Readings</strong> — Optional links students should cite during the debate.</li>
              <li><strong>Deadlines</strong> — Memo submission deadline and debate completion deadline.</li>
              <li><strong>Student Access</strong> — Restrict by email domain (e.g., columbia.edu) and/or require an access code.</li>
            </ul>
          </div>

          <div>
            <h3 className="font-semibold text-gray-900">2. Share the Signup Link</h3>
            <p className="mt-1">
              Each assignment gets a unique signup URL and QR code (visible on the
              assignment detail page). Share it with students via your LMS, email,
              or in class. Students create an account, verify their email with a
              6-digit code, and optionally select their weekly availability for
              scheduling.
            </p>
          </div>

          <div>
            <h3 className="font-semibold text-gray-900">3. Students Upload Memos</h3>
            <p className="mt-1">
              Students upload a PDF memo taking a position on the debate topic.
              The system automatically:
            </p>
            <ul className="mt-2 ml-4 list-disc space-y-1">
              <li>Extracts text from the PDF</li>
              <li>Uses Claude AI to analyze the memo — identifying the student&apos;s position (net positive / net negative), thesis, key claims, stance strength, and reading citations</li>
              <li>Asks the student to confirm or flag the detected position</li>
            </ul>
            <p className="mt-2">
              You can track memo progress on the <strong>Students</strong> tab of each assignment.
              Statuses: uploaded → extracting → analyzing → analyzed.
            </p>
          </div>

          <div>
            <h3 className="font-semibold text-gray-900">4. Generate Pairings</h3>
            <p className="mt-1">
              Once at least 2 students have analyzed memos, go to the <strong>Pairings</strong> tab
              and click <strong>Generate Pairings with AI</strong>. Claude Sonnet analyzes all
              memos and creates optimal pairings based on:
            </p>
            <ul className="mt-2 ml-4 list-disc space-y-1">
              <li>Maximum divergence in specific arguments (not just overall position)</li>
              <li>Same-position students CAN be paired if their claims differ significantly</li>
              <li>Priority for students citing the same readings but drawing different conclusions</li>
              <li>Overlapping availability windows (from signup)</li>
            </ul>
            <p className="mt-2">
              Each pair gets a private Daily.co video room and a matchmaking reason
              explaining why they were paired.
            </p>
          </div>

          <div>
            <h3 className="font-semibold text-gray-900">5. Send Debate Invitations</h3>
            <p className="mt-1">
              Click <strong>Send Invitations</strong> to email all paired students. The email includes
              their debate link, deadline, tips, and suggested meeting times based on
              shared availability. Students can also find their debate link on
              their dashboard.
            </p>
          </div>

          <div>
            <h3 className="font-semibold text-gray-900">6. Students Debate (~13 min)</h3>
            <p className="mt-1">
              Both students join the video call and go through a structured debate:
            </p>
            <table className="mt-2 w-full text-left">
              <thead>
                <tr className="border-b text-xs text-gray-500">
                  <th className="pb-1 pr-4">Phase</th>
                  <th className="pb-1 pr-4">Duration</th>
                  <th className="pb-1">Description</th>
                </tr>
              </thead>
              <tbody className="text-sm">
                <tr className="border-b border-gray-100"><td className="py-1.5 pr-4 font-medium">Opening</td><td className="pr-4">2 min each</td><td>Present thesis and key arguments</td></tr>
                <tr className="border-b border-gray-100"><td className="py-1.5 pr-4 font-medium">Cross-Exam</td><td className="pr-4">3 min each</td><td>Question opponent on evidence gaps</td></tr>
                <tr className="border-b border-gray-100"><td className="py-1.5 pr-4 font-medium">Rebuttal</td><td className="pr-4">1 min each</td><td>Address opponent&apos;s strongest points</td></tr>
                <tr><td className="py-1.5 pr-4 font-medium">Closing</td><td className="pr-4">30 sec each</td><td>Final summary</td></tr>
              </tbody>
            </table>
            <p className="mt-2">
              An <strong>AI moderator</strong> (Claude Haiku) listens in real time via Deepgram
              speech-to-text and can: prompt for evidence citations, fact-check
              claims against readings, nudge silent students, and guide phase
              transitions. Students can click <strong>+1 min</strong> to extend any phase or
              <strong> Skip</strong> to move ahead.
            </p>
          </div>

          <div>
            <h3 className="font-semibold text-gray-900">7. Automatic Evaluation</h3>
            <p className="mt-1">
              After the debate ends, the evaluator service scores each student using Claude Sonnet. If you defined rubric criteria, each criterion is scored individually with reasoning. Otherwise, the system uses default dimensions:
            </p>
            <ul className="mt-2 ml-4 list-disc space-y-1">
              <li>Opening Clarity, Rebuttal Quality, Reading Accuracy, Evidence Use (0–100 each)</li>
              <li>Evidence-of-Reading score — confidence the student actually read the materials</li>
              <li>Pass / Fail / Review recommendation</li>
              <li>Integrity flags — e.g., &ldquo;couldn&apos;t explain a mechanism referenced in memo&rdquo;</li>
              <li>AI-generated narrative summary (2–3 paragraphs)</li>
            </ul>
            <p className="mt-2">
              The evaluation uses <strong>both</strong> the debate transcript and the student&apos;s
              memo. The transcript drives scoring; the memo serves as a reference
              to verify authenticity and consistency.
            </p>
          </div>

          <div>
            <h3 className="font-semibold text-gray-900">8. Review Results &amp; Export</h3>
            <p className="mt-1">
              On the <strong>Results</strong> tab you see all completed debates with scores and
              pass/fail badges. Click into any debate for a side-by-side comparison
              of both students. Click a student name for their full profile:
              memo analysis, evaluation scores, AI summary, and the complete
              transcript. You can export all scores as CSV.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* What You Can See & Do */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Pages &amp; Features</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-sm text-gray-700">
          <div>
            <h3 className="font-semibold text-gray-900">Dashboard</h3>
            <p>See all your assignments with student counts, memo progress, and deadlines at a glance.</p>
          </div>
          <div>
            <h3 className="font-semibold text-gray-900">Assignment Detail (4 tabs)</h3>
            <ul className="mt-1 ml-4 list-disc space-y-1">
              <li><strong>Overview</strong> — Progress metrics, signup link with QR code, danger zone (reset).</li>
              <li><strong>Students</strong> — Every enrolled student with memo status, position, confirmation, and debate status. Click any student for their full profile.</li>
              <li><strong>Pairings</strong> — Generate AI pairings, send invitations, view/reset pairings.</li>
              <li><strong>Results</strong> — Completed debates with scores and side-by-side evaluations.</li>
            </ul>
          </div>
          <div>
            <h3 className="font-semibold text-gray-900">Student Profile</h3>
            <p>
              Full name, email, memo analysis (thesis, claims, stance), evaluation scores
              (with radar chart or criteria breakdown), integrity flags, AI summary,
              and the complete debate transcript with phase labels.
            </p>
          </div>
          <div>
            <h3 className="font-semibold text-gray-900">Debate View</h3>
            <p>
              Side-by-side evaluation of both students: scores, summaries, integrity
              flags, and the full transcript. You can reset a debate to let students retry.
            </p>
          </div>
          <div>
            <h3 className="font-semibold text-gray-900">Students Page</h3>
            <p>
              All students in your course. See memo and debate completion counts.
              Impersonate any student to see exactly what they see.
            </p>
          </div>
          <div>
            <h3 className="font-semibold text-gray-900">Costs</h3>
            <p>
              AI usage breakdown: total cost, Claude API calls &amp; tokens, Deepgram
              transcription minutes. Drill down by assignment and call type.
            </p>
          </div>
          <div>
            <h3 className="font-semibold text-gray-900">A/V Test</h3>
            <p>Test your microphone and camera before using the platform.</p>
          </div>
        </CardContent>
      </Card>

      {/* AI Models */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">AI Models Used</CardTitle>
        </CardHeader>
        <CardContent>
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b text-xs text-gray-500">
                <th className="pb-2 pr-4">Task</th>
                <th className="pb-2 pr-4">Model</th>
                <th className="pb-2">Why</th>
              </tr>
            </thead>
            <tbody className="text-gray-700">
              <tr className="border-b border-gray-100"><td className="py-2 pr-4 font-medium">Memo Analysis</td><td className="pr-4">Claude Haiku</td><td>Fast extraction of position, thesis, claims</td></tr>
              <tr className="border-b border-gray-100"><td className="py-2 pr-4 font-medium">Pairing</td><td className="pr-4">Claude Sonnet</td><td>Sophisticated argument matching across all students</td></tr>
              <tr className="border-b border-gray-100"><td className="py-2 pr-4 font-medium">Live Moderation</td><td className="pr-4">Claude Haiku</td><td>Real-time speed required during debate</td></tr>
              <tr className="border-b border-gray-100"><td className="py-2 pr-4 font-medium">Evaluation &amp; Scoring</td><td className="pr-4">Claude Sonnet</td><td>Detailed rubric analysis of transcript + memo</td></tr>
              <tr className="border-b border-gray-100"><td className="py-2 pr-4 font-medium">Debrief (for students)</td><td className="pr-4">Claude Haiku</td><td>Quick personalized feedback</td></tr>
              <tr><td className="py-2 pr-4 font-medium">Speech-to-Text</td><td className="pr-4">Deepgram Nova-3</td><td>Live transcription during debate</td></tr>
            </tbody>
          </table>
        </CardContent>
      </Card>

      {/* Tips */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Tips</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-gray-700">
          <ul className="ml-4 list-disc space-y-2">
            <li>
              <strong>Custom rubric criteria</strong> produce much better evaluations than the
              default dimensions. Add 3–5 criteria that match your learning
              objectives.
            </li>
            <li>
              <strong>Link readings</strong> so the AI moderator can fact-check student claims
              against actual sources during the debate.
            </li>
            <li>
              <strong>Review integrity flags</strong> carefully. If a student is flagged for
              not being able to explain something from their memo, it may indicate
              they didn&apos;t write it themselves.
            </li>
            <li>
              <strong>Reset individual debates</strong> if there was a technical issue or
              no-show. The students will be able to try again with a fresh session.
            </li>
            <li>
              <strong>Check the Costs page</strong> periodically to monitor AI usage. Each
              debate costs roughly $0.50–$1.50 depending on length and number of
              AI interventions.
            </li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
