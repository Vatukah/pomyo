import { useBootStore } from "./store/boot.store";
import CanvasContainer from "./components/canvas/canvas";
import BigDigit from "./components/BigDigit";
import Model from "./components/tomato";
import ModelGroup from "./components/canvas/modelGroup";
import ActionToolWrapper from "./components/ActionToolWrapper";
import TodoPanel from "./components/panel/todoPanel";

import SyncTimerTotitle from "./components/SyncTimerToTitle";
import { PomyoLoader } from "./components/PomyoLoader";

function App() {
  const isBooted = useBootStore((s) => s.isBooted);

  if (!isBooted) return <PomyoLoader />;
  return (
    <>
      <SyncTimerTotitle />
      <main className="main-container">
        <BigDigit />
        <CanvasContainer>
          <ModelGroup>
            <Model key={"tomato-modal"} />
          </ModelGroup>
        </CanvasContainer>

        <ActionToolWrapper />

        <TodoPanel />
      </main>
    </>
  );
}

export default App;
