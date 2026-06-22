import { evaluateWeeklyRules } from "../src/services/weeklyRulesCron";
evaluateWeeklyRules().then(() => { console.log("done"); process.exit(0); });
