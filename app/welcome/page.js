import WelcomeScreen from "@/components/features/welcome/WelcomeScreen";

export default async function Welcome({searchParams}) {
  const {lang}=await searchParams;
  return <WelcomeScreen language={lang==="en"?"en":"id"}/>;
}
