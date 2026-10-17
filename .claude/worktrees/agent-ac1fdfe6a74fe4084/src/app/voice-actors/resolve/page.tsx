import { redirect } from "next/navigation";
import { isJapaneseVoiceActor, searchPerson } from "@/lib/tmdb";

interface PageProps {
  searchParams: Promise<{ name?: string; aniListId?: string }>;
}

function sanitizeName(raw: string): string {
  return raw
    .replace(/<[^>]*>/g, "")
    .replace(/[<>"'`]/g, "")
    .trim()
    .slice(0, 100);
}

export default async function VoiceActorResolvePage({
  searchParams,
}: PageProps) {
  const { name: rawName = "" } = await searchParams;
  const name = sanitizeName(rawName);

  if (!name) {
    redirect("/voice-actors");
  }

  let personId: number | null = null;
  try {
    const data = await searchPerson(name);
    const top =
      data.results.find(isJapaneseVoiceActor) ?? data.results[0] ?? null;
    personId = top?.id ?? null;
  } catch (error) {
    console.error("[/voice-actors/resolve] TMDb error:", error);
  }

  if (personId !== null) {
    redirect(`/voice-actors/${personId}`);
  }

  redirect(`/voice-actors?q=${encodeURIComponent(name)}`);
}
