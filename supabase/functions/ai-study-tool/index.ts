import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { type, content } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    let systemPrompt = "";
    let tools: any[] | undefined;
    let tool_choice: any | undefined;

    if (type === "summarize") {
      systemPrompt = `You are a study assistant. Summarize the given notes into a clear, structured format with:
- Key Concepts (bullet points)
- Important Details
- Summary (2-3 sentences)
Keep it concise and student-friendly. Do NOT use chatbot language. Just output the summary directly.`;
    } else if (type === "quiz") {
      systemPrompt = `Generate exactly 5 multiple-choice questions about the given topic. Each question must have exactly 4 options.`;
      tools = [{
        type: "function",
        function: {
          name: "generate_quiz",
          description: "Generate quiz questions",
          parameters: {
            type: "object",
            properties: {
              questions: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    question: { type: "string" },
                    options: { type: "array", items: { type: "string" }, minItems: 4, maxItems: 4 },
                    correct: { type: "number", description: "0-based index of correct option" },
                  },
                  required: ["question", "options", "correct"],
                  additionalProperties: false,
                },
              },
            },
            required: ["questions"],
            additionalProperties: false,
          },
        },
      }];
      tool_choice = { type: "function", function: { name: "generate_quiz" } };
    } else if (type === "flashcards") {
      systemPrompt = `Generate exactly 8 flashcards about the given topic.`;
      tools = [{
        type: "function",
        function: {
          name: "generate_flashcards",
          description: "Generate flashcards",
          parameters: {
            type: "object",
            properties: {
              cards: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    front: { type: "string", description: "Question or term" },
                    back: { type: "string", description: "Answer or definition" },
                  },
                  required: ["front", "back"],
                  additionalProperties: false,
                },
              },
            },
            required: ["cards"],
            additionalProperties: false,
          },
        },
      }];
      tool_choice = { type: "function", function: { name: "generate_flashcards" } };
    } else {
      throw new Error("Invalid type. Use 'summarize', 'quiz', or 'flashcards'.");
    }

    const body: any = {
      model: "google/gemini-3-flash-preview",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content },
      ],
    };
    if (tools) { body.tools = tools; body.tool_choice = tool_choice; }

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limited. Please try again shortly." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "Usage limit reached." }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const t = await response.text();
      console.error("AI error:", response.status, t);
      throw new Error("AI gateway error");
    }

    const data = await response.json();

    let result;
    if (type === "summarize") {
      result = data.choices?.[0]?.message?.content || "No summary generated.";
    } else if (type === "quiz") {
      const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
      const parsed = JSON.parse(toolCall?.function?.arguments || "{}");
      result = parsed.questions || [];
    } else if (type === "flashcards") {
      const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
      const parsed = JSON.parse(toolCall?.function?.arguments || "{}");
      result = parsed.cards || [];
    }

    return new Response(JSON.stringify({ result }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("Error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
