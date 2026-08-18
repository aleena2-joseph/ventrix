require("./config/env");
const SimulationEngine = require("./SimulationEngine");

const engine = new SimulationEngine(1000);

engine.start().catch((error) => {
    console.error("Failed to start simulation:", error.message);
    process.exit(1);
});

process.on("SIGINT", async () => {
    console.log("\nStopping simulation...");

    await engine.stop();

    process.exit(0);
});
