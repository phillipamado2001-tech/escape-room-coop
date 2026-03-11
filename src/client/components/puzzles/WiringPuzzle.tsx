"use client";

import { useState, useCallback } from "react";

interface Props {
  config: any;
  puzzleId: string;
  puzzleName: string;
  flavorText: string;
  onAttempt: (puzzleId: string, answer: unknown) => void;
  onRequestHint: (puzzleId: string) => void;
  onClose: () => void;
}

export function WiringPuzzle({
  config,
  puzzleId,
  puzzleName,
  flavorText,
  onAttempt,
  onRequestHint,
  onClose,
}: Props) {
  const nodes: string[] = config.nodes || [];
  const clue =
    config.clue_for_connections ?? config.clueForConnections ?? "";

  const [connections, setConnections] = useState<[string, string][]>([]);
  const [selectedNode, setSelectedNode] = useState<string | null>(null);

  const handleNodeClick = useCallback(
    (node: string) => {
      if (!selectedNode) {
        setSelectedNode(node);
        return;
      }
      if (selectedNode === node) {
        setSelectedNode(null);
        return;
      }
      // Create connection between selectedNode and node
      const pair: [string, string] = [selectedNode, node];
      setConnections((prev) => {
        // Remove any existing connection involving either node
        const filtered = prev.filter(
          ([a, b]) =>
            !(a === selectedNode && b === node) &&
            !(a === node && b === selectedNode)
        );
        // Toggle: if connection existed, remove it; otherwise add it
        const existed = prev.some(
          ([a, b]) =>
            (a === selectedNode && b === node) ||
            (a === node && b === selectedNode)
        );
        return existed ? filtered : [...filtered, pair];
      });
      setSelectedNode(null);
    },
    [selectedNode]
  );

  const getNodeConnections = (node: string) =>
    connections
      .filter(([a, b]) => a === node || b === node)
      .map(([a, b]) => (a === node ? b : a));

  const handleSubmit = () => {
    onAttempt(puzzleId, connections);
  };

  const handleReset = () => {
    setConnections([]);
    setSelectedNode(null);
  };

  return (
    <div className="flex flex-col items-center gap-6 max-w-md w-full">
      <div className="text-center">
        <h3 className="text-white font-display text-xl">{puzzleName}</h3>
        <p className="text-gray-500 text-sm mt-1 italic">{flavorText}</p>
        <p className="text-gray-600 text-xs mt-1 font-mono">
          Click two nodes to connect them
        </p>
      </div>

      {clue && (
        <div className="w-full p-3 bg-void-800 border border-void-500 rounded-lg">
          <p className="text-gray-400 text-xs">{clue}</p>
        </div>
      )}

      {/* Node grid */}
      <div className="w-full flex flex-wrap gap-3 justify-center">
        {nodes.map((node, i) => {
          const isSelected = selectedNode === node;
          const nodeConns = getNodeConnections(node);
          const hasConnections = nodeConns.length > 0;
          return (
            <button
              key={`node-${i}`}
              onClick={() => handleNodeClick(node)}
              className={`px-4 py-3 rounded-lg border text-sm font-mono transition-all ${
                isSelected
                  ? "bg-amber-400/20 border-amber-400 text-amber-400 scale-105"
                  : hasConnections
                  ? "bg-emerald-400/10 border-emerald-400/40 text-emerald-400"
                  : "bg-void-700 border-void-500 text-gray-300 hover:border-gray-400"
              }`}
            >
              {node}
              {hasConnections && (
                <div className="text-[10px] text-gray-500 mt-0.5">
                  → {nodeConns.join(", ")}
                </div>
              )}
            </button>
          );
        })}
      </div>

      {selectedNode && (
        <p className="text-amber-400 text-xs">
          Select another node to connect with: {selectedNode}
        </p>
      )}

      {/* Current connections */}
      {connections.length > 0 && (
        <div className="w-full p-3 bg-void-800/60 border border-void-600 rounded-lg">
          <div className="text-gray-500 text-xs font-mono uppercase mb-2">
            Connections ({connections.length})
          </div>
          <div className="flex flex-wrap gap-2">
            {connections.map(([a, b], i) => (
              <span
                key={i}
                className="px-2 py-1 bg-void-600 border border-emerald-400/20 rounded text-emerald-400 text-xs font-mono"
              >
                {a} ↔ {b}
              </span>
            ))}
          </div>
        </div>
      )}

      <div className="flex gap-2 w-full">
        <button
          onClick={handleSubmit}
          disabled={connections.length === 0}
          className="flex-1 py-2 bg-gradient-to-r from-iris-400 to-iris-500 text-white font-bold rounded-lg hover:opacity-90 text-sm disabled:opacity-40"
        >
          Submit
        </button>
        <button
          onClick={handleReset}
          className="px-3 py-2 bg-void-600 border border-void-500 text-gray-400 rounded-lg hover:text-white text-sm"
        >
          Reset
        </button>
        <button
          onClick={() => onRequestHint(puzzleId)}
          className="px-3 py-2 bg-void-600 border border-amber-400/30 text-amber-400 rounded-lg hover:bg-void-500 text-sm"
        >
          Hint
        </button>
      </div>

      <button onClick={onClose} className="text-gray-500 hover:text-white text-xs focus-ring rounded px-2 py-1">
        Back
      </button>
    </div>
  );
}
