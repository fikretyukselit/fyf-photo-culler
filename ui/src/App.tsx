import { useEffect } from "react";
import "./App.css";
import { useSessionStore } from "@/lib/stores";
import { api } from "@/lib/api";
import { Landing } from "@/components/Landing";
import { Processing } from "@/components/Processing";
import { Review } from "@/components/Review";
import { Export } from "@/components/Export";
import { Titlebar } from "@/components/Titlebar";

function App() {
  const { screen, backendPort } = useSessionStore();

  useEffect(() => {
    const devPort = 9470;
    api.setPort(backendPort ?? devPort);
  }, [backendPort]);

  return (
    <div className="h-screen w-screen flex flex-col overflow-hidden bg-background">
      <Titlebar />
      <main className="flex-1 overflow-hidden">
        {screen === "landing" && <Landing />}
        {screen === "processing" && <Processing />}
        {screen === "review" && <Review />}
        {screen === "export" && <Export />}
      </main>
    </div>
  );
}

export default App;
