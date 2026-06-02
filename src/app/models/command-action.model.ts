export type RenderChannel = 'speak' | 'print' | 'bloom';
export type BloomContent = 'editable' | 'readonly' | 'pdf' | 'report' | 'balloon';
export type HighlightStyle = 'label-glow' | 'border' | 'none';
export type ValueType = 'number' | 'string' | 'bool' | 'enum';
export type RecoveryClass = 'act' | 'confirm';
export type PhrasingSource = 'seed' | 'mined';

export interface CmdTarget {
  targetId: number;
  widget: string;
  label: string;
  renderChannel: RenderChannel;
  bloomContent?: BloomContent | null;
  highlightStyle: HighlightStyle;
  apiEndpoint?: string | null;
  apiField?: string | null;
  valueType?: ValueType | null;
  chatSettable: boolean;
  renderHints?: string | null;
  isEnabled: boolean;
  cmdActionVersion: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface CmdAction {
  actionId: number;
  verb: string;
  recoveryClass: RecoveryClass;
  storesTouched?: string | null;
  isEnabled: boolean;
  cmdActionVersion: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface CmdPhrasing {
  phrasingId: number;
  targetId: number;
  actionId?: number | null;
  phrase: string;
  source: PhrasingSource;
  hits: number;
  isEnabled: boolean;
  cmdActionVersion: string;
  createdAt?: string;
  updatedAt?: string;
}
