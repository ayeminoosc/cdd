---
description: Contract-Driven Development (CDD) workflow commands
---

Execute CDD commands and orchestrate contract implementation workflow.

## Pseudo Contract Grammar

CDD now supports two descriptive styles inside `.cdd` contracts:

1. **Inline directives** using `description:` keys (legacy)
2. **Doc comment blocks** using the familiar multi-line format:

```
/**
 * High level description...
 */
service Agent {
  /**
   * Method description...
   */
  func AgentResponse react(string request, WorkingMemory memory, AgentConfig config);
}
```

Doc comments are attached to the next declaration (service, data, aspect, field, or method) and included in the implementation context and hashing flow. This allows contracts written in the `engine.cdd` style to produce stable hashes as long as the relevant descriptions remain unchanged.

## Available Commands
- `build` - Analyze contracts and prepare implementation instructions
- `hash` - Generate hashes for implemented contracts
- `status` - Show contract status report

```bash
# Execute CDD command
node .claude/commands/cdd_wrapper.js $ARGUMENTS

# If build command created implementation context, provide guidance
if [ "$1" = "build" ]; then
  echo ""
  echo "After implementing the contracts, run: /cdd hash"
  echo "This will update the hashes and mark the contracts as implemented."
fi
```