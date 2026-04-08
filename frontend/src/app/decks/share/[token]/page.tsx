import DeckShareClient from "./DeckShareClient";

export default async function DeckSharePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  return <DeckShareClient token={token} />;
}
