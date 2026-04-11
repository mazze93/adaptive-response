// Public surface of @adaptive/ui
export { AlternativesBlock } from "./components/AlternativesBlock.js";
export { DecisionBanner }    from "./components/DecisionBanner.js";
export { ListBlock }         from "./components/ListBlock.js";
export { ResponseRenderer }  from "./components/ResponseRenderer.js";
export { SectionBlock }      from "./components/SectionBlock.js";
export { TldrBlock }         from "./components/TldrBlock.js";

// Re-export types so consumers don't need a separate @adaptive/sdk import
export type {
  AdaptiveResponse,
  Alternative,
  Answer,
  Decision,
  Meta,
  Section,
} from "@adaptive/sdk";
