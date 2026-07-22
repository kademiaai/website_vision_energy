"use server";

export type OcrResult = {
  success: boolean;
  message: string;
  full_name?: string;
  id_number?: string;
};

const PUTER_TOKEN_EXPIRED_MESSAGE =
  "Token xác thực AI đã hết hạn. Vui lòng liên hệ quản trị viên để làm mới (chạy scratch/refresh-puter-token.js).";

// PUTER_AUTH_TOKEN is a browser session token, not a stable API key — it
// periodically expires and Puter responds with 401 { code: "reauth_required" }.
// Detect that specifically so it isn't confused with a genuine AI outage.
function isPuterAuthExpired(status: number, errorText: string): boolean {
  if (status !== 401 && status !== 403) return false;
  try {
    const body = JSON.parse(errorText);
    return body?.code === "reauth_required";
  } catch {
    return errorText.includes("reauth_required");
  }
}

/**
 * CLEAN & OPTIMIZED OCR Service Action.
 * Uses Puter's OpenAI-compatible REST API for maximum stability and speed.
 * No dependencies on browser-focused SDKs.
 */
export async function performOcr(formData: FormData): Promise<OcrResult> {
  try {
    const file = formData.get("file") as File;
    if (!file) throw new Error("Vui lòng tải lên một tệp tin.");

    const token = process.env.PUTER_AUTH_TOKEN;
    if (!token) throw new Error("Hệ thống chưa được cấu hình token Puter.");

    // [OPTIMIZATION] Streamlined base64 conversion
    const arrayBuffer = await file.arrayBuffer();
    const dataUri = `data:${file.type};base64,${Buffer.from(arrayBuffer).toString("base64")}`;

    const url = "https://api.puter.com/puterai/openai/v1/chat/completions";

    const prompt = `
      This is a Vietnamese Citizen ID Card (CCCD).
      EXTRACT:
      1. full_name (Họ và tên) - ALL CAPS
      2. id_number (Số CCCD) - 12 digits
      Return JSON ONLY: {"full_name": "...", "id_number": "..."}
    `;

    // [OPTIMIZATION] We use GPT-4o-Mini as the primary model as it's the most reliable for vision OCR via Puter
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${token}`,
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "user",
            content: [
              { type: "text", text: prompt },
              { type: "image_url", image_url: { url: dataUri } },
            ],
          },
        ],
        response_format: { type: "json_object" },
        temperature: 0, // Precise extraction
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.warn(`[OCR] GPT-4o-mini failed (${response.status}): ${errorText}`);
      if (isPuterAuthExpired(response.status, errorText)) {
        throw new Error(PUTER_TOKEN_EXPIRED_MESSAGE);
      }

      // [FALLBACK] If GPT-4o-Mini fails for a non-auth reason, try Mistral as a second option
      console.warn(`[OCR] Trying Mistral fallback...`);
      const retryResponse = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`,
        },
        body: JSON.stringify({
          model: "mistral",
          messages: [
            {
              role: "user",
              content: [
                { type: "text", text: prompt },
                { type: "image_url", image_url: { url: dataUri } },
              ],
            },
          ],
          response_format: { type: "json_object" },
        }),
      });

      if (!retryResponse.ok) {
        const retryErrorText = await retryResponse.text();
        console.error(`[OCR] Mistral fallback failed (${retryResponse.status}): ${retryErrorText}`);
        if (isPuterAuthExpired(retryResponse.status, retryErrorText)) {
          throw new Error(PUTER_TOKEN_EXPIRED_MESSAGE);
        }
        throw new Error("Dịch vụ AI hiện không khả dụng. Vui lòng thử lại sau.");
      }
      return processAiResponse(await retryResponse.json());
    }

    return processAiResponse(await response.json());

  } catch (error: any) {
    console.error("[OCR] Error:", error?.message || error);
    return { success: false, message: error?.message || "Lỗi xử lý ảnh.", full_name: undefined, id_number: undefined };
  }
}

/**
 * Cleanly processes the AI response and handles JSON parsing.
 */
function processAiResponse(result: any): OcrResult {
  const responseText = result.choices?.[0]?.message?.content || "";
  if (!responseText) throw new Error("AI không trả về kết quả.");

  let data = { full_name: "", id_number: "" };
  try {
    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    if (jsonMatch) data = JSON.parse(jsonMatch[0]);
  } catch (err) {
    throw new Error("Lỗi phân tích dữ liệu AI.");
  }

  const hasData = Boolean(data.full_name || data.id_number);
  return {
    success: hasData,
    message: hasData ? "Thành công" : "Không tìm thấy thông tin trên CCCD.",
    full_name: data.full_name?.toUpperCase().trim() || undefined,
    id_number: data.id_number?.replace(/\D/g, "").trim() || undefined,
  };
}
