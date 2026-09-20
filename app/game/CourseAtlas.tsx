'use client';
import { Check, Lock, Play, Flag } from 'lucide-react';
import { LEVELS, WORLDS, type Level } from './levels';
import type { Snapshot } from './engine';

export function CourseThumbnail({ level }: { level: Level }) {
  const area = level.areas[level.mainArea],
    length = area.length;
  const sx = (z: number) => ((13 - z) / length) * 260;
  const sy = (y: number) => 63 - y * 5.1;
  const colors = {
    ground: '#87ca4c',
    brick: '#c7834f',
    stone: '#97a7b6',
    cloud: '#fff5df',
    wood: '#e0ad65',
    tree: '#65b557',
    shroom: '#f88179',
    coral: '#ee91b2',
    bridge: '#dfb578',
  };
  return (
    <svg
      className={`course-thumbnail thumbnail-${level.theme}`}
      viewBox="0 0 260 76"
      aria-hidden="true"
    >
      {level.kind === 'Underwater' && (
        <path
          d="M0 10 Q10 6 20 10 T40 10 T60 10 T80 10 T100 10 T120 10 T140 10 T160 10 T180 10 T200 10 T220 10 T240 10 T260 10"
          fill="none"
          stroke="#a5e8ef"
          strokeWidth="1"
          opacity=".5"
        />
      )}
      {level.surfaces
        .filter((s) => s.area === level.mainArea)
        .map((s, i) => (
          <rect
            key={`s${i}`}
            x={sx(s.z + s.d / 2)}
            y={sy(s.y + s.h / 2)}
            width={Math.max(0.7, (s.d / length) * 260)}
            height={Math.max(1, Math.min(76, s.h * 5.1))}
            fill={colors[s.style ?? 'ground']}
            opacity={s.breakable ? 0.75 : 1}
          />
        ))}
      {level.pipes
        .filter((p) => p.area === level.mainArea)
        .map((p, i) => (
          <g key={`p${i}`} fill="#40c761">
            <rect
              x={sx(p.z + (p.d ?? 1.8) / 2)}
              y={sy(p.y + p.height)}
              width={Math.max(2, ((p.d ?? 1.8) / length) * 260)}
              height={Math.min(70, p.height * 5.1)}
            />
            <rect
              x={sx(p.z + (p.d ?? 1.8) / 2) - 0.5}
              y={sy(p.y + p.height)}
              width={Math.max(3, ((p.d ?? 1.8) / length) * 260 + 1)}
              height="2"
              fill="#9deb88"
            />
          </g>
        ))}
      {level.blocks
        .filter((b) => b.area === level.mainArea && !b.hidden)
        .map((b, i) => (
          <rect
            key={`b${i}`}
            x={sx(b.z) - 0.7}
            y={sy(b.y) - 1}
            width="1.8"
            height="3.7"
            fill="#ffdb68"
          />
        ))}
      {level.enemies
        .filter((e) => e.area === level.mainArea)
        .map((e, i) => (
          <circle
            key={`e${i}`}
            cx={sx(e.z)}
            cy={sy(e.y) - 1.5}
            r="1.1"
            fill="#f88772"
          />
        ))}
      <path
        d="M249 63 V21 l8 3-8 3"
        stroke="#fff0b5"
        fill="#f26458"
        strokeWidth="1"
      />
    </svg>
  );
}
export function CourseAtlas({
  state,
  disabled,
  onSelect,
  idPrefix = 'atlas',
}: {
  state: Snapshot;
  disabled: boolean;
  idPrefix?: string;
  onSelect: (index: number) => void;
}) {
  return (
    <div className="course-atlas" data-course-atlas>
      {WORLDS.map((world, w) => (
        <section
          className="world-section"
          key={world.name}
          aria-labelledby={`${idPrefix}-world-heading-${w}`}
        >
          <div className="world-section-heading">
            <div>
              <span className="world-number">
                {String(w + 1).padStart(2, '0')}
              </span>
              <h3 id={`${idPrefix}-world-heading-${w}`}>{world.name}</h3>
            </div>
            <span>
              {
                state.records.slice(w * 4, w * 4 + 4).filter((r) => r.cleared)
                  .length
              }{' '}
              / 4 CLEARED
            </span>
          </div>
          <div className="level-grid">
            {LEVELS.slice(w * 4, w * 4 + 4).map((level, j) => {
              const i = w * 4 + j,
                record = state.records[i],
                locked = i > state.unlocked,
                cleared = !!record?.cleared;
              return (
                <button
                  key={level.id}
                  className={`level-card nes-level-card level-${level.theme} ${locked ? 'locked' : cleared ? 'completed' : 'next-course'}`}
                  disabled={disabled || locked}
                  onClick={() => onSelect(i)}
                  aria-label={`${locked ? 'Locked: ' : ''}World ${level.id}, ${level.name}${cleared ? ', cleared' : ''}`}
                  data-level={i}
                >
                  <div className="card-preview">
                    <CourseThumbnail level={level} />
                    <span className="course-id">{level.id}</span>
                    <span className="course-lock" aria-hidden="true">
                      {locked ? (
                        <Lock size={15} />
                      ) : cleared ? (
                        <Check size={16} />
                      ) : (
                        <Play size={14} fill="currentColor" />
                      )}
                    </span>
                  </div>
                  <div className="level-card-body">
                    <small>{level.kind.toUpperCase()}</small>
                    <h4>{level.name}</h4>
                    <div className="course-card-status">
                      {locked ? (
                        <>
                          <Lock size={11} /> Clear {LEVELS[i - 1].id} to unlock
                        </>
                      ) : cleared ? (
                        <>
                          <Check size={12} /> Cleared · Replay
                        </>
                      ) : (
                        <>
                          <Flag size={12} /> Ready to play
                        </>
                      )}
                    </div>
                    {cleared && (
                      <div className="personal-best">
                        BEST {record.score.toLocaleString()} ·{' '}
                        {Math.floor(record.bestTime / 60)}:
                        {String(record.bestTime % 60).padStart(2, '0')}
                      </div>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        </section>
      ))}
    </div>
  );
}
