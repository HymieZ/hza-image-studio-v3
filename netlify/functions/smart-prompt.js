const Anthropic = require("@anthropic-ai/sdk");

const TYPE_INSTRUCTIONS = {
  main_image: `Amazon main hero image. Pure white background. Product fills 80-85% of frame. No text, no props, no lifestyle elements. Clean studio lighting from upper left. Sharp focus throughout. Amazon-compliant.`,
  lifestyle: `Amazon lifestyle image showing the product in natural use. Show a real person or aspirational setting using the product. Include 2-3 visible benefit callout badges with labels. Warm, aspirational lighting. The product is clearly visible and prominent.`,
  infographic: `Amazon product infographic. Grid or split-panel layout. Product in center-left. 4-6 feature callout areas with icon placeholders and text label areas. Clean background with brand-appropriate color accents. Professional, high contrast.`,
  comparison: `Amazon us-vs-them comparison chart. Table layout with our product column highlighted (border glow or color). Competitor columns grayed. Checkmark/X icon rows. Professional, factual presentation.`,
  before_after: `Amazon before/after results image. Split composition — left side muted/problem state, right side vibrant/solution state. Clear divider. Result stat callout in the center. Product visible in the after section.`,
  aplus: `Amazon A+ Premium Content banner. Wide horizontal format. Rich, layered design with background texture or gradient. Product prominently placed with lifestyle context. Section areas for feature callouts. Premium, editorial feel.`,
  banner: `Amazon storefront banner. Wide panoramic composition. Strong brand identity. Product featured with lifestyle backdrop. Clear visual hierarchy from left to right. Headline area at top-left or center.`,
  packaging: `3D photorealistic product packaging mockup. Slight angle showing front and side of packaging. Studio lighting with soft shadow. Clean background. Premium material rendering. Label and surface details visible.`,
  custom: `Professional Amazon product image optimized for conversion. Clean, high-quality production. Strong visual hierarchy. Product prominently featured.`,
};

exports.handler = async function(event, context) {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: "Method Not Allowed" };
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return { statusCode: 500, body: JSON.stringify({ error: "Anthropic API key not configured" }) };
  }

  let body;
  try {
    body = JSON.parse(event.body);
  } catch (e) {
    return { statusCode: 400, body: JSON.stringify({ error: "Invalid JSON" }) };
  }

  const { productName, category, benefits, imageType, blueprint, additionalNotes, variationNum } = body;

  const typeGuide = TYPE_INSTRUCTIONS[imageType] || TYPE_INSTRUCTIONS.custom;
  const benefitList = (benefits || []).filter(Boolean).join(", ");
  const variationNote = variationNum > 1
    ? `This is variation ${variationNum}. Keep the same structural layout but vary the color treatment, composition angle, or background atmosphere to make it feel distinct.`
    : "";

  const systemPrompt = `You are an expert Amazon listing image prompt engineer who writes detailed, precise image generation prompts for Gemini.

You understand:
- Amazon compliance and visual standards for every image type
- What drives click-through rate and conversion on Amazon listings
- How to structure compositions that perform in Amazon visual search
- How to instruct Gemini to produce complete, polished images (never blank or empty areas)

Rules for every prompt you write:
- Always describe a COMPLETE, finished-looking image — no blank boxes, no empty callout frames
- For text callout areas: instruct Gemini to render short visible PLACEHOLDER LABELS like [BENEFIT 1], [KEY STAT], [FEATURE NAME] in simple bold text — these are visible markers the team replaces, not invisible blanks
- Be specific about lighting, composition, colors, and product placement
- Always mention the product by name and category
- Keep prompts to 3-5 sentences — precise and actionable
- Return ONLY the prompt text. No preamble, no explanation.`;

  const userMessage = `Write a Gemini image generation prompt for this Amazon ${imageType.replace(/_/g," ")} image:

Product: ${productName || "the product"}
Category: ${category || "Health & Beauty"}
Key Benefits/Features: ${benefitList || "premium quality, effective formula, trusted brand"}
Image Type Requirements: ${typeGuide}
${blueprint ? `Structural Blueprint (extracted from competitor analysis — match this layout):\n${blueprint.substring(0, 2000)}` : "No blueprint — use best-practice defaults for this image type."}
${additionalNotes ? `Client-specific notes: ${additionalNotes}` : ""}
${variationNote}`;

  try {
    const client = new Anthropic({ apiKey });
    const message = await client.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 600,
      system: systemPrompt,
      messages: [{ role: "user", content: userMessage }],
    });

    const prompt = message.content[0]?.text?.trim() || "";
    console.log(`[SMART-PROMPT] type=${imageType} product="${productName}" promptLength=${prompt.length}`);

    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt }),
    };
  } catch (err) {
    console.error("[SMART-PROMPT] Error:", err.message);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: err.message }),
    };
  }
};
