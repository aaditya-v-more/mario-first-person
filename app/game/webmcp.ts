import type { GameEngine } from './engine';
type Registry = {
  registerTool: (
    tool: {
      name: string;
      title: string;
      description: string;
      inputSchema: object;
      annotations: { readOnlyHint: boolean; untrustedContentHint: boolean };
      execute: (input: unknown) => Promise<unknown>;
    },
    options: { signal: AbortSignal },
  ) => void | Promise<void>;
};
export function registerGameTools(game: GameEngine) {
  const context = (document as Document & { modelContext?: Registry })
    .modelContext;
  if (!context?.registerTool) return;
  const lifecycle = new AbortController();
  const actions = [
    {
      name: 'get_game_status',
      title: 'Read game status',
      description:
        'Read the current course status, coins, lives, remaining time, and score.',
      readOnly: true,
      act: () => {},
    },
    {
      name: 'start_game',
      title: 'Start or resume the game',
      description:
        'Start the course or resume a paused game. Does not move the player or complete the course.',
      readOnly: false,
      act: () => {
        if (
          game.state.status === 'over' ||
          game.state.status === 'won' ||
          game.state.status === 'clear'
        )
          throw new Error(
            'The course has ended. Use next_course after a clear, or restart_game to play again.',
          );
        game.start(false);
      },
    },
    {
      name: 'next_course',
      title: 'Continue to the next course',
      description:
        'Continue after clearing a course. Preserves adventure score and lives. Only works on the course-clear screen.',
      readOnly: false,
      act: () => game.nextLevel(false),
    },
    {
      name: 'pause_game',
      title: 'Pause the game',
      description: 'Pause the active course without resetting progress.',
      readOnly: false,
      act: () => game.pause(),
    },
    {
      name: 'restart_game',
      title: 'Restart the course',
      description:
        'Reset all coins, lives, score, time, and position and begin the course again.',
      readOnly: false,
      act: () => game.restart(false),
    },
  ];
  for (const action of actions) {
    try {
      void Promise.resolve(
        context.registerTool(
          {
            name: action.name,
            title: action.title,
            description: action.description,
            inputSchema: {
              type: 'object',
              properties: {},
              additionalProperties: false,
            },
            annotations: {
              readOnlyHint: action.readOnly,
              untrustedContentHint: false,
            },
            async execute(input: unknown) {
              if (
                input === null ||
                typeof input !== 'object' ||
                Array.isArray(input) ||
                Object.keys(input).length
              )
                throw new Error('Expected an empty object.');
              action.act();
              await new Promise<void>((resolve) =>
                requestAnimationFrame(() => resolve()),
              );
              return { ...game.state };
            },
          },
          { signal: lifecycle.signal },
        ),
      ).catch(() => {});
    } catch {
      /* WebMCP is optional; visible game controls remain available. */
    }
  }
  return () => lifecycle.abort();
}
