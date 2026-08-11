import { redirect } from "next/navigation";
import AcceptInviteClient from "./AcceptInviteClient";

export default async function AcceptInvitePage({
  searchParams,
}: {
  searchParams?: Promise<{ token?: string }>;
}) {
  const params = await searchParams;

  if (!params?.token) {
    redirect("/login");
  }

  return <AcceptInviteClient token={params.token} />;
}