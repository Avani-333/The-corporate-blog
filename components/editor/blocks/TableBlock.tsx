'use client';

import { TableBlockData, ContentBlock } from '@/types/blocks';
import { EditorState, EditorAction } from '@/lib/editor-state';
import { BlockWrapper } from './BlockWrapper';
import { Plus, Minus, Table } from 'lucide-react';

interface TableBlockProps {
  block: ContentBlock & { data: TableBlockData };
  state: EditorState;
  onAction: (action: EditorAction) => void;
  readonly?: boolean;
  isSelected?: boolean;
  isFocused?: boolean;
}

export function TableBlock({ 
  block, 
  state, 
  onAction, 
  readonly = false,
  isSelected = false,
  isFocused = false 
}: TableBlockProps) {
  
  // Initialize with basic 2x2 table if empty
  const initializeTable = () => {
    if (!block.data.rows || block.data.rows.length === 0) {
      onAction({
        type: 'UPDATE_BLOCK',
        payload: {
          id: block.id,
          data: {
            ...block.data,
            rows: [
              { cells: ['Header 1', 'Header 2'] },
              { cells: ['Cell 1', 'Cell 2'] }
            ],
            hasHeader: true
          }
        }
      });
    }
  };

  // Initialize table if needed
  if (!block.data.rows || block.data.rows.length === 0) {
    initializeTable();
    return null;
  }

  if (readonly) {
    return (
      <div className="prose prose-lg max-w-none">
        <div className="overflow-x-auto">
          <table className="min-w-full border-collapse border border-gray-300">
            {block.data.hasHeader && (
              <thead>
                <tr className="bg-gray-50">
                  {block.data.rows[0]?.cells.map((cell, cellIndex) => (
                    <th key={cellIndex} className="border border-gray-300 px-4 py-2 text-left font-semibold">
                      {cell || <span className="text-gray-400 italic">Empty cell</span>}
                    </th>
                  ))}
                </tr>
              </thead>
            )}
            <tbody>
              {block.data.rows.slice(block.data.hasHeader ? 1 : 0).map((row, rowIndex) => (
                <tr key={rowIndex}>
                  {row.cells.map((cell, cellIndex) => (
                    <td key={cellIndex} className="border border-gray-300 px-4 py-2">
                      {cell || <span className="text-gray-400 italic">Empty cell</span>}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {block.data.caption && (
          <p className="text-center text-gray-600 mt-2 text-sm">
            {block.data.caption}
          </p>
        )}
      </div>
    );
  }

  return (
    <BlockWrapper
      block={block}
      isSelected={isSelected}
      isFocused={isFocused}
      onAction={onAction}
    >
      <div className="space-y-4">
        <div className="overflow-x-auto border border-gray-300 rounded-lg">
          <table className="min-w-full border-collapse">
            {block.data.hasHeader && (
              <thead>
                <tr className="bg-gray-50">
                  {block.data.rows[0]?.cells.map((cell, cellIndex) => (
                    <th key={cellIndex} className="border-r border-gray-300 last:border-r-0">
                      <input
                        type="text"
                        value={cell}
                        onChange={(e) => {
                          const newRows = [...block.data.rows];
                          newRows[0].cells[cellIndex] = e.target.value;
                          onAction({
                            type: 'UPDATE_BLOCK',
                            payload: { id: block.id, data: { ...block.data, rows: newRows } }
                          });
                        }}
                        className="w-full px-4 py-2 bg-transparent border-none outline-none font-semibold focus:bg-white"
                        placeholder={`Header ${cellIndex + 1}`}
                      />
                    </th>
                  ))}
                </tr>
              </thead>
            )}
            <tbody>
              {block.data.rows.slice(block.data.hasHeader ? 1 : 0).map((row, rowIndex) => {
                const actualRowIndex = rowIndex + (block.data.hasHeader ? 1 : 0);
                return (
                  <tr key={actualRowIndex}>
                    {row.cells.map((cell, cellIndex) => (
                      <td key={cellIndex} className="border-r border-t border-gray-300 last:border-r-0">
                        <input
                          type="text"
                          value={cell}
                          onChange={(e) => {
                            const newRows = [...block.data.rows];
                            newRows[actualRowIndex].cells[cellIndex] = e.target.value;
                            onAction({
                              type: 'UPDATE_BLOCK',
                              payload: { id: block.id, data: { ...block.data, rows: newRows } }
                            });
                          }}
                          className="w-full px-4 py-2 bg-transparent border-none outline-none focus:bg-gray-50"
                          placeholder={`Cell ${actualRowIndex + 1}, ${cellIndex + 1}`}
                        />
                      </td>
                    ))}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Table Controls */}
        {isSelected && (
          <div className="flex flex-wrap gap-2 text-sm">
            <button 
              onClick={() => {
                const newRows = [...block.data.rows];
                const newCells = Array(newRows[0]?.cells.length || 2).fill('');
                newRows.push({ cells: newCells });
                onAction({
                  type: 'UPDATE_BLOCK',
                  payload: { id: block.id, data: { ...block.data, rows: newRows } }
                });
              }}
              className="flex items-center gap-1 px-2 py-1 bg-primary-50 text-primary-700 rounded hover:bg-primary-100"
            >
              <Plus className="w-3 h-3" /> Add Row
            </button>
            
            <button 
              onClick={() => {
                const newRows = block.data.rows.map(row => ({
                  cells: [...row.cells, '']
                }));
                onAction({
                  type: 'UPDATE_BLOCK',
                  payload: { id: block.id, data: { ...block.data, rows: newRows } }
                });
              }}
              className="flex items-center gap-1 px-2 py-1 bg-primary-50 text-primary-700 rounded hover:bg-primary-100"
            >
              <Plus className="w-3 h-3" /> Add Column
            </button>

            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={block.data.hasHeader || false}
                onChange={(e) => onAction({
                  type: 'UPDATE_BLOCK',
                  payload: { id: block.id, data: { ...block.data, hasHeader: e.target.checked } }
                })}
                className="rounded border-gray-300"
              />
              Header Row
            </label>
          </div>
        )}

        {/* Caption */}
        <input
          type="text"
          value={block.data.caption || ''}
          onChange={(e) => onAction({
            type: 'UPDATE_BLOCK',
            payload: { id: block.id, data: { ...block.data, caption: e.target.value } }
          })}
          placeholder="Table caption (optional)"
          className="w-full text-center text-gray-600 bg-transparent border-none outline-none placeholder-gray-400 text-sm"
        />
      </div>
    </BlockWrapper>
  );
}