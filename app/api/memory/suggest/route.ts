import Anthropic from "@anthropic-ai/sdk"

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

const extractTool: Anthropic.Tool = {
  name: "extract_memories",
  description:
    "Extrait les faits importants et persistants sur l'utilisateur à partir d'une conversation. " +
    "N'inclure que des informations vraiment utiles à mémoriser à long terme : préférences stables, objectifs, habitudes, données personnelles significatives. " +
    "Ignorer les informations transientes ou déjà triviales. Retourner une liste vide si rien de mémorisable.",
  input_schema: {
    type: "object",
    properties: {
      suggestions: {
        type: "array",
        items: {
          type: "object",
          properties: {
            title: {
              type: "string",
              description: "Titre court et factuel (max 60 caractères)",
            },
            content: {
              type: "string",
              description: "Description concise du fait à mémoriser",
            },
            category: {
              type: "string",
              enum: ["general", "goals", "habits", "preferences", "projects", "personal"],
            },
          },
          required: ["title", "content", "category"],
        },
        maxItems: 3,
      },
    },
    required: ["suggestions"],
  },
}

export async function POST(request: Request) {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey || apiKey === "your_anthropic_api_key_here") {
    return Response.json({ suggestions: [] }, { status: 503 })
  }

  let query: string
  let response: string
  try {
    const body = await request.json()
    query = String(body.query ?? "").trim()
    response = String(body.response ?? "").trim()
  } catch {
    return Response.json({ suggestions: [] }, { status: 400 })
  }

  if (!query || !response) {
    return Response.json({ suggestions: [] })
  }

  try {
    const msg = await client.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 512,
      tools: [extractTool],
      tool_choice: { type: "tool", name: "extract_memories" },
      system:
        "Tu analyses des conversations entre un utilisateur et son assistant IA personnel. " +
        "Extrais uniquement les faits durables et personnels qui méritent d'être mémorisés pour enrichir les futures interactions.",
      messages: [
        {
          role: "user",
          content: `Question de l'utilisateur : ${query}\n\nRéponse de l'assistant : ${response}`,
        },
      ],
    })

    const toolBlock = msg.content.find((b): b is Anthropic.ToolUseBlock => b.type === "tool_use")
    if (!toolBlock) return Response.json({ suggestions: [] })

    const { suggestions } = toolBlock.input as {
      suggestions: Array<{ title: string; content: string; category: string }>
    }
    return Response.json({ suggestions: suggestions ?? [] })
  } catch {
    return Response.json({ suggestions: [] })
  }
}
