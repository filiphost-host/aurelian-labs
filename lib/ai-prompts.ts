import type { AnalystPacket } from "@/lib/ai-packet";

/**
 * The rules the model works under. They exist because this app's whole premise is
 * that a number carries its source: analysis is welcome, invented facts and trading
 * advice are not.
 */
const sharedRules = [
  "You are reading a packet of already-computed facts from a private investment workbench. It is your only source.",
  "Never state a number, holding, date, or event that is not in the packet. If something needed is missing, say plainly that the packet does not contain it.",
  "Never recommend buying, selling, holding, or sizing anything. Do not suggest what the owner should do with their money.",
  "Do not predict prices or assign probabilities to outcomes.",
  "Values are in Norwegian kroner unless the packet says otherwise. Some prices are delayed, manual, or estimated; the packet says which, and you should respect that when leaning on a figure.",
  "Where the packet says something was withheld, work with what remains and do not speculate about the missing part.",
  "Write in plain, concrete English for one careful reader. No headings, no bullet lists, no preamble about what you are about to do.",
];

export function analystInstructions(mode: AnalystPacket["mode"]) {
  const specific = mode === "brief"
    ? [
        "Your task: write a short narrative that connects today's insights into one picture, in three or four paragraphs.",
        "Say what the insights have in common, what the owner may be reading too much into, and what a careful reader would want to check next.",
        "Include at least one explicit counterargument to the most attention-grabbing insight.",
      ]
    : [
        "Your task: argue the bear case against the thesis in the packet, in three or four paragraphs.",
        "Take the thesis seriously and attack its weakest load-bearing assumption, not a strawman.",
        "Use the risks the owner already wrote down as a starting point, then say what they appear to have left out.",
        "Finish by naming the specific evidence that would show the thesis is breaking, and the evidence that would show it is intact.",
      ];

  return [...sharedRules, ...specific].join("\n");
}

export function analystPrompt(packet: AnalystPacket, packetText: string) {
  const task = packet.mode === "brief"
    ? "Write the narrative described in your instructions, using only this packet."
    : "Argue the bear case described in your instructions, using only this packet.";
  return `${task}\n\n--- PACKET START ---\n${packetText}\n--- PACKET END ---`;
}
