import { redirect } from "next/navigation";
import PrivacyTools from "@/components/PrivacyTools";
import { createSupabaseServerClient, hasSupabaseConfig } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function AccountPrivacyPage() {
  if (!hasSupabaseConfig()) redirect("/auth?setup=required");
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/auth?next=/account/privacy");
  return <PrivacyTools initialMarketingOptIn={user.user_metadata.marketing_opt_in === true} />;
}
