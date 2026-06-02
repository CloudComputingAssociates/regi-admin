import { Component, OnInit } from '@angular/core';
import { FormControl, Validators } from '@angular/forms';
import { MatSnackBar } from '@angular/material/snack-bar';
import { RegiApiService } from '../services/regi-api.service';
import {
  CmdTarget, CmdAction, CmdPhrasing,
  RenderChannel, BloomContent, HighlightStyle, ValueType,
  RecoveryClass, PhrasingSource
} from '../models/command-action.model';

const DEFAULT_VERSION = '1.0';

@Component({
  selector: 'app-command-action',
  templateUrl: './command-action.component.html',
  styleUrls: ['./command-action.component.scss']
})
export class CommandActionComponent implements OnInit {

  // ========================================
  // ENUM OPTIONS (for dropdowns)
  // ========================================
  renderChannels: RenderChannel[] = ['speak', 'print', 'bloom'];
  bloomContents: BloomContent[] = ['editable', 'readonly', 'pdf', 'report', 'balloon'];
  highlightStyles: HighlightStyle[] = ['label-glow', 'border', 'none'];
  valueTypes: ValueType[] = ['number', 'string', 'bool', 'enum'];
  recoveryClasses: RecoveryClass[] = ['act', 'confirm'];
  phrasingSources: PhrasingSource[] = ['seed', 'mined'];

  // ========================================
  // TARGETS state
  // ========================================
  targets: CmdTarget[] = [];
  selectedTarget: CmdTarget | null = null;
  isLoadingTargets = false;
  isSavingTarget = false;
  targetSearchControl = new FormControl<string>('');

  tWidgetCtrl = new FormControl<string>('', { nonNullable: true });
  tLabelCtrl = new FormControl<string>('', { nonNullable: true });
  tRenderChannelCtrl = new FormControl<RenderChannel>('print', { nonNullable: true });
  tBloomContentCtrl = new FormControl<BloomContent | null>(null);
  tHighlightStyleCtrl = new FormControl<HighlightStyle>('none', { nonNullable: true });
  tApiEndpointCtrl = new FormControl<string | null>(null);
  tApiFieldCtrl = new FormControl<string | null>(null);
  tValueTypeCtrl = new FormControl<ValueType | null>(null);
  tChatSettableCtrl = new FormControl<boolean>(false, { nonNullable: true });
  tRenderHintsCtrl = new FormControl<string | null>(null);
  tIsEnabledCtrl = new FormControl<boolean>(true, { nonNullable: true });
  tVersionCtrl = new FormControl<string>(DEFAULT_VERSION, { nonNullable: true });

  private originalTarget: CmdTarget | null = null;

  // ========================================
  // ACTIONS state
  // ========================================
  actions: CmdAction[] = [];
  selectedAction: CmdAction | null = null;
  isLoadingActions = false;
  isSavingAction = false;
  actionSearchControl = new FormControl<string>('');

  aVerbCtrl = new FormControl<string>('', { nonNullable: true });
  aRecoveryClassCtrl = new FormControl<RecoveryClass>('act', { nonNullable: true });
  aStoresTouchedCtrl = new FormControl<string | null>(null);
  aIsEnabledCtrl = new FormControl<boolean>(true, { nonNullable: true });
  aVersionCtrl = new FormControl<string>(DEFAULT_VERSION, { nonNullable: true });

  private originalAction: CmdAction | null = null;

  // ========================================
  // PHRASINGS state
  // ========================================
  phrasings: CmdPhrasing[] = [];
  selectedPhrasing: CmdPhrasing | null = null;
  isLoadingPhrasings = false;
  isSavingPhrasing = false;
  phrasingSearchControl = new FormControl<string>('');
  phrasingTargetFilterCtrl = new FormControl<number | null>(null);

  pTargetIdCtrl = new FormControl<number | null>(null, [Validators.required]);
  pActionIdCtrl = new FormControl<number | null>(null);
  pPhraseCtrl = new FormControl<string>('', { nonNullable: true });
  pSourceCtrl = new FormControl<PhrasingSource>('seed', { nonNullable: true });
  pIsEnabledCtrl = new FormControl<boolean>(true, { nonNullable: true });
  pVersionCtrl = new FormControl<string>(DEFAULT_VERSION, { nonNullable: true });

  private originalPhrasing: CmdPhrasing | null = null;

  // Bulk add
  bulkTargetIdCtrl = new FormControl<number | null>(null, [Validators.required]);
  bulkActionIdCtrl = new FormControl<number | null>(null);
  bulkSourceCtrl = new FormControl<PhrasingSource>('seed', { nonNullable: true });
  bulkVersionCtrl = new FormControl<string>(DEFAULT_VERSION, { nonNullable: true });
  bulkPhrasesCtrl = new FormControl<string>('', { nonNullable: true });
  isBulkAdding = false;

  constructor(
    private apiService: RegiApiService,
    private snackBar: MatSnackBar
  ) {}

  ngOnInit(): void {
    this.loadTargets();
    this.loadActions();
    this.loadPhrasings();

    // Keep chatSettable enabled state in sync with dependent fields
    this.tRenderChannelCtrl.valueChanges.subscribe(() => this.refreshChatSettableEnablement());
    this.tBloomContentCtrl.valueChanges.subscribe(() => this.refreshChatSettableEnablement());
    this.tApiEndpointCtrl.valueChanges.subscribe(() => this.refreshChatSettableEnablement());
    this.tApiFieldCtrl.valueChanges.subscribe(() => this.refreshChatSettableEnablement());

    // bloomContent is only meaningful when channel === 'bloom'
    this.tRenderChannelCtrl.valueChanges.subscribe(ch => {
      if (ch !== 'bloom') {
        this.tBloomContentCtrl.setValue(null);
        this.tBloomContentCtrl.disable({ emitEvent: false });
      } else {
        this.tBloomContentCtrl.enable({ emitEvent: false });
      }
    });

    // storesTouched only allowed when recoveryClass === 'confirm'
    this.aRecoveryClassCtrl.valueChanges.subscribe(rc => {
      if (rc !== 'confirm') {
        this.aStoresTouchedCtrl.setValue(null);
        this.aStoresTouchedCtrl.disable({ emitEvent: false });
      } else {
        this.aStoresTouchedCtrl.enable({ emitEvent: false });
      }
    });
  }

  // ============================================================
  // TARGETS
  // ============================================================

  loadTargets(): void {
    this.isLoadingTargets = true;
    this.apiService.listCmdTargets().subscribe({
      next: (rows) => {
        this.targets = rows || [];
        this.isLoadingTargets = false;
      },
      error: () => {
        this.isLoadingTargets = false;
        this.snackBar.open('Failed to load targets', 'Close', { duration: 5000 });
      }
    });
  }

  get filteredTargets(): CmdTarget[] {
    const q = (this.targetSearchControl.value || '').trim().toLowerCase();
    if (!q) return this.targets;
    return this.targets.filter(t =>
      t.widget.toLowerCase().includes(q) ||
      t.label.toLowerCase().includes(q)
    );
  }

  selectTarget(t: CmdTarget): void {
    this.selectedTarget = t;
    this.originalTarget = { ...t };
    this.tWidgetCtrl.setValue(t.widget);
    this.tLabelCtrl.setValue(t.label);
    this.tRenderChannelCtrl.setValue(t.renderChannel);
    this.tBloomContentCtrl.setValue(t.bloomContent ?? null);
    this.tHighlightStyleCtrl.setValue(t.highlightStyle);
    this.tApiEndpointCtrl.setValue(t.apiEndpoint ?? null);
    this.tApiFieldCtrl.setValue(t.apiField ?? null);
    this.tValueTypeCtrl.setValue(t.valueType ?? null);
    this.tChatSettableCtrl.setValue(t.chatSettable);
    this.tRenderHintsCtrl.setValue(t.renderHints ?? null);
    this.tIsEnabledCtrl.setValue(t.isEnabled);
    this.tVersionCtrl.setValue(t.cmdActionVersion || DEFAULT_VERSION);
    this.tVersionCtrl.disable({ emitEvent: false });

    if (t.renderChannel === 'bloom') this.tBloomContentCtrl.enable({ emitEvent: false });
    else this.tBloomContentCtrl.disable({ emitEvent: false });

    this.refreshChatSettableEnablement();
  }

  private refreshChatSettableEnablement(): void {
    const channel = this.tRenderChannelCtrl.value;
    const bloom = this.tBloomContentCtrl.value;
    const endpoint = (this.tApiEndpointCtrl.value || '').trim();
    const field = (this.tApiFieldCtrl.value || '').trim();
    const allowed = channel === 'bloom' && bloom === 'editable' && endpoint.length > 0 && field.length > 0;
    if (allowed) {
      this.tChatSettableCtrl.enable({ emitEvent: false });
    } else {
      if (this.tChatSettableCtrl.value) this.tChatSettableCtrl.setValue(false, { emitEvent: false });
      this.tChatSettableCtrl.disable({ emitEvent: false });
    }
  }

  get chatSettableHint(): string {
    return 'Requires renderChannel=bloom, bloomContent=editable, plus apiEndpoint and apiField.';
  }

  newTarget(): void {
    const stub: Partial<CmdTarget> = {
      widget: 'NewWidget',
      label: 'newField',
      renderChannel: 'print',
      bloomContent: null,
      highlightStyle: 'none',
      apiEndpoint: null,
      apiField: null,
      valueType: null,
      chatSettable: false,
      renderHints: null,
      isEnabled: true,
      cmdActionVersion: DEFAULT_VERSION
    };
    this.apiService.createCmdTarget(stub).subscribe({
      next: (created) => {
        this.targets = [created, ...this.targets];
        this.selectTarget(created);
        this.snackBar.open('Target created', 'Close', { duration: 2000 });
      },
      error: () => this.snackBar.open('Failed to create target', 'Close', { duration: 5000 })
    });
  }

  hasTargetChanges(): boolean {
    if (!this.originalTarget) return false;
    const o = this.originalTarget;
    return this.tWidgetCtrl.value !== o.widget ||
      this.tLabelCtrl.value !== o.label ||
      this.tRenderChannelCtrl.value !== o.renderChannel ||
      (this.tBloomContentCtrl.value ?? null) !== (o.bloomContent ?? null) ||
      this.tHighlightStyleCtrl.value !== o.highlightStyle ||
      (this.tApiEndpointCtrl.value ?? null) !== (o.apiEndpoint ?? null) ||
      (this.tApiFieldCtrl.value ?? null) !== (o.apiField ?? null) ||
      (this.tValueTypeCtrl.value ?? null) !== (o.valueType ?? null) ||
      this.tChatSettableCtrl.value !== o.chatSettable ||
      (this.tRenderHintsCtrl.value ?? null) !== (o.renderHints ?? null) ||
      this.tIsEnabledCtrl.value !== o.isEnabled;
  }

  saveTarget(): void {
    if (!this.selectedTarget || !this.originalTarget) return;

    // Validate renderHints JSON if provided
    const hints = (this.tRenderHintsCtrl.value || '').trim();
    if (hints) {
      try { JSON.parse(hints); }
      catch {
        this.snackBar.open('Render Hints is not valid JSON', 'Close', { duration: 4000 });
        return;
      }
    }

    // Mirror server CHECK: bloomContent required iff renderChannel === 'bloom'
    if (this.tRenderChannelCtrl.value === 'bloom' && !this.tBloomContentCtrl.value) {
      this.snackBar.open('Bloom Content is required when render channel is bloom', 'Close', { duration: 4000 });
      return;
    }

    const updated: CmdTarget = {
      ...this.originalTarget,
      widget: this.tWidgetCtrl.value,
      label: this.tLabelCtrl.value,
      renderChannel: this.tRenderChannelCtrl.value,
      bloomContent: this.tRenderChannelCtrl.value === 'bloom' ? this.tBloomContentCtrl.value : null,
      highlightStyle: this.tHighlightStyleCtrl.value,
      apiEndpoint: this.tApiEndpointCtrl.value || null,
      apiField: this.tApiFieldCtrl.value || null,
      valueType: this.tValueTypeCtrl.value || null,
      chatSettable: this.tChatSettableCtrl.value,
      renderHints: hints || null,
      isEnabled: this.tIsEnabledCtrl.value
    };

    this.isSavingTarget = true;
    this.apiService.updateCmdTarget(this.selectedTarget.targetId, updated).subscribe({
      next: (saved) => {
        const idx = this.targets.findIndex(x => x.targetId === saved.targetId);
        if (idx >= 0) this.targets[idx] = saved;
        this.selectTarget(saved);
        this.isSavingTarget = false;
        this.snackBar.open('Target saved', 'Close', { duration: 2000 });
      },
      error: () => {
        this.isSavingTarget = false;
        this.snackBar.open('Failed to save target', 'Close', { duration: 5000 });
      }
    });
  }

  deleteTarget(): void {
    if (!this.selectedTarget) return;
    if (!confirm(`Delete target "${this.selectedTarget.widget} · ${this.selectedTarget.label}"?`)) return;
    const id = this.selectedTarget.targetId;
    this.apiService.deleteCmdTarget(id).subscribe({
      next: () => {
        this.targets = this.targets.filter(t => t.targetId !== id);
        this.selectedTarget = null;
        this.originalTarget = null;
        this.snackBar.open('Target deleted', 'Close', { duration: 2000 });
      },
      error: () => this.snackBar.open('Failed to delete target', 'Close', { duration: 5000 })
    });
  }

  // ============================================================
  // ACTIONS
  // ============================================================

  loadActions(): void {
    this.isLoadingActions = true;
    this.apiService.listCmdActions().subscribe({
      next: (rows) => {
        this.actions = rows || [];
        this.isLoadingActions = false;
      },
      error: () => {
        this.isLoadingActions = false;
        this.snackBar.open('Failed to load actions', 'Close', { duration: 5000 });
      }
    });
  }

  get filteredActions(): CmdAction[] {
    const q = (this.actionSearchControl.value || '').trim().toLowerCase();
    if (!q) return this.actions;
    return this.actions.filter(a => a.verb.toLowerCase().includes(q));
  }

  selectAction(a: CmdAction): void {
    this.selectedAction = a;
    this.originalAction = { ...a };
    this.aVerbCtrl.setValue(a.verb);
    this.aRecoveryClassCtrl.setValue(a.recoveryClass);
    this.aStoresTouchedCtrl.setValue(a.storesTouched ?? null);
    this.aIsEnabledCtrl.setValue(a.isEnabled);
    this.aVersionCtrl.setValue(a.cmdActionVersion || DEFAULT_VERSION);
    this.aVersionCtrl.disable({ emitEvent: false });

    if (a.recoveryClass === 'confirm') this.aStoresTouchedCtrl.enable({ emitEvent: false });
    else this.aStoresTouchedCtrl.disable({ emitEvent: false });
  }

  newAction(): void {
    const stub: Partial<CmdAction> = {
      verb: 'newVerb',
      recoveryClass: 'act',
      storesTouched: null,
      isEnabled: true,
      cmdActionVersion: DEFAULT_VERSION
    };
    this.apiService.createCmdAction(stub).subscribe({
      next: (created) => {
        this.actions = [created, ...this.actions];
        this.selectAction(created);
        this.snackBar.open('Action created', 'Close', { duration: 2000 });
      },
      error: () => this.snackBar.open('Failed to create action', 'Close', { duration: 5000 })
    });
  }

  hasActionChanges(): boolean {
    if (!this.originalAction) return false;
    const o = this.originalAction;
    return this.aVerbCtrl.value !== o.verb ||
      this.aRecoveryClassCtrl.value !== o.recoveryClass ||
      (this.aStoresTouchedCtrl.value ?? null) !== (o.storesTouched ?? null) ||
      this.aIsEnabledCtrl.value !== o.isEnabled;
  }

  saveAction(): void {
    if (!this.selectedAction || !this.originalAction) return;

    const stores = (this.aStoresTouchedCtrl.value || '').trim();
    if (stores) {
      try { JSON.parse(stores); }
      catch {
        this.snackBar.open('Stores Touched is not valid JSON', 'Close', { duration: 4000 });
        return;
      }
    }

    const updated: CmdAction = {
      ...this.originalAction,
      verb: this.aVerbCtrl.value,
      recoveryClass: this.aRecoveryClassCtrl.value,
      storesTouched: this.aRecoveryClassCtrl.value === 'confirm' ? (stores || null) : null,
      isEnabled: this.aIsEnabledCtrl.value
    };

    this.isSavingAction = true;
    this.apiService.updateCmdAction(this.selectedAction.actionId, updated).subscribe({
      next: (saved) => {
        const idx = this.actions.findIndex(x => x.actionId === saved.actionId);
        if (idx >= 0) this.actions[idx] = saved;
        this.selectAction(saved);
        this.isSavingAction = false;
        this.snackBar.open('Action saved', 'Close', { duration: 2000 });
      },
      error: () => {
        this.isSavingAction = false;
        this.snackBar.open('Failed to save action', 'Close', { duration: 5000 });
      }
    });
  }

  deleteAction(): void {
    if (!this.selectedAction) return;
    if (!confirm(`Delete action "${this.selectedAction.verb}"?`)) return;
    const id = this.selectedAction.actionId;
    this.apiService.deleteCmdAction(id).subscribe({
      next: () => {
        this.actions = this.actions.filter(a => a.actionId !== id);
        this.selectedAction = null;
        this.originalAction = null;
        this.snackBar.open('Action deleted', 'Close', { duration: 2000 });
      },
      error: () => this.snackBar.open('Failed to delete action', 'Close', { duration: 5000 })
    });
  }

  // ============================================================
  // PHRASINGS
  // ============================================================

  loadPhrasings(): void {
    this.isLoadingPhrasings = true;
    const targetId = this.phrasingTargetFilterCtrl.value;
    const filters = targetId !== null && targetId !== undefined ? { targetId } : undefined;
    this.apiService.listCmdPhrasings(filters).subscribe({
      next: (rows) => {
        this.phrasings = rows || [];
        this.isLoadingPhrasings = false;
      },
      error: () => {
        this.isLoadingPhrasings = false;
        this.snackBar.open('Failed to load phrasings', 'Close', { duration: 5000 });
      }
    });
  }

  onPhrasingTargetFilterChange(): void {
    this.selectedPhrasing = null;
    this.originalPhrasing = null;
    this.loadPhrasings();
  }

  get filteredPhrasings(): CmdPhrasing[] {
    const q = (this.phrasingSearchControl.value || '').trim().toLowerCase();
    if (!q) return this.phrasings;
    return this.phrasings.filter(p => p.phrase.toLowerCase().includes(q));
  }

  targetLabel(targetId: number | null | undefined): string {
    if (targetId === null || targetId === undefined) return '';
    const t = this.targets.find(x => x.targetId === targetId);
    return t ? `${t.widget} · ${t.label}` : `#${targetId}`;
  }

  actionLabel(actionId: number | null | undefined): string {
    if (actionId === null || actionId === undefined) return '';
    const a = this.actions.find(x => x.actionId === actionId);
    return a ? a.verb : `#${actionId}`;
  }

  selectPhrasing(p: CmdPhrasing): void {
    this.selectedPhrasing = p;
    this.originalPhrasing = { ...p };
    this.pTargetIdCtrl.setValue(p.targetId);
    this.pActionIdCtrl.setValue(p.actionId ?? null);
    this.pPhraseCtrl.setValue(p.phrase);
    this.pSourceCtrl.setValue(p.source);
    this.pIsEnabledCtrl.setValue(p.isEnabled);
    this.pVersionCtrl.setValue(p.cmdActionVersion || DEFAULT_VERSION);
    this.pVersionCtrl.disable({ emitEvent: false });
  }

  newPhrasing(): void {
    const targetId = this.phrasingTargetFilterCtrl.value
      ?? this.targets[0]?.targetId
      ?? null;
    if (targetId === null) {
      this.snackBar.open('Create a Target first', 'Close', { duration: 4000 });
      return;
    }
    const stub: Partial<CmdPhrasing> = {
      targetId,
      actionId: null,
      phrase: 'new phrase',
      source: 'seed',
      isEnabled: true,
      cmdActionVersion: DEFAULT_VERSION
    };
    this.apiService.createCmdPhrasing(stub).subscribe({
      next: (created) => {
        this.phrasings = [created, ...this.phrasings];
        this.selectPhrasing(created);
        this.snackBar.open('Phrasing created', 'Close', { duration: 2000 });
      },
      error: () => this.snackBar.open('Failed to create phrasing', 'Close', { duration: 5000 })
    });
  }

  hasPhrasingChanges(): boolean {
    if (!this.originalPhrasing) return false;
    const o = this.originalPhrasing;
    return this.pTargetIdCtrl.value !== o.targetId ||
      (this.pActionIdCtrl.value ?? null) !== (o.actionId ?? null) ||
      this.pPhraseCtrl.value !== o.phrase ||
      this.pSourceCtrl.value !== o.source ||
      this.pIsEnabledCtrl.value !== o.isEnabled;
  }

  savePhrasing(): void {
    if (!this.selectedPhrasing || !this.originalPhrasing) return;
    const targetId = this.pTargetIdCtrl.value;
    if (targetId === null || targetId === undefined) {
      this.snackBar.open('Target is required', 'Close', { duration: 4000 });
      return;
    }
    const updated: CmdPhrasing = {
      ...this.originalPhrasing,
      targetId,
      actionId: this.pActionIdCtrl.value ?? null,
      phrase: this.pPhraseCtrl.value,
      source: this.pSourceCtrl.value,
      isEnabled: this.pIsEnabledCtrl.value
    };

    this.isSavingPhrasing = true;
    this.apiService.updateCmdPhrasing(this.selectedPhrasing.phrasingId, updated).subscribe({
      next: (saved) => {
        const idx = this.phrasings.findIndex(x => x.phrasingId === saved.phrasingId);
        if (idx >= 0) this.phrasings[idx] = saved;
        this.selectPhrasing(saved);
        this.isSavingPhrasing = false;
        this.snackBar.open('Phrasing saved', 'Close', { duration: 2000 });
      },
      error: () => {
        this.isSavingPhrasing = false;
        this.snackBar.open('Failed to save phrasing', 'Close', { duration: 5000 });
      }
    });
  }

  deletePhrasing(): void {
    if (!this.selectedPhrasing) return;
    if (!confirm(`Delete phrasing "${this.selectedPhrasing.phrase}"?`)) return;
    const id = this.selectedPhrasing.phrasingId;
    this.apiService.deleteCmdPhrasing(id).subscribe({
      next: () => {
        this.phrasings = this.phrasings.filter(p => p.phrasingId !== id);
        this.selectedPhrasing = null;
        this.originalPhrasing = null;
        this.snackBar.open('Phrasing deleted', 'Close', { duration: 2000 });
      },
      error: () => this.snackBar.open('Failed to delete phrasing', 'Close', { duration: 5000 })
    });
  }

  // ===== BULK ADD =====

  get bulkPhraseCount(): number {
    const raw = this.bulkPhrasesCtrl.value || '';
    return raw.split('\n').map(s => s.trim()).filter(s => s.length > 0).length;
  }

  bulkAdd(): void {
    const targetId = this.bulkTargetIdCtrl.value;
    if (targetId === null || targetId === undefined) {
      this.snackBar.open('Pick a target before adding phrases', 'Close', { duration: 4000 });
      return;
    }
    const lines = (this.bulkPhrasesCtrl.value || '')
      .split('\n')
      .map(s => s.trim())
      .filter(s => s.length > 0);
    if (lines.length === 0) {
      this.snackBar.open('Paste one or more phrases', 'Close', { duration: 4000 });
      return;
    }
    const actionId = this.bulkActionIdCtrl.value ?? null;
    const source = this.bulkSourceCtrl.value || 'seed';
    const version = (this.bulkVersionCtrl.value || DEFAULT_VERSION).trim() || DEFAULT_VERSION;

    const payload: Partial<CmdPhrasing>[] = lines.map(phrase => ({
      targetId,
      actionId,
      phrase,
      source,
      isEnabled: true,
      cmdActionVersion: version
    }));

    this.isBulkAdding = true;
    this.apiService.bulkCreateCmdPhrasings(payload).subscribe({
      next: (created) => {
        const rows = Array.isArray(created) ? created : [];
        this.phrasings = [...rows, ...this.phrasings];
        this.bulkPhrasesCtrl.setValue('');
        this.isBulkAdding = false;
        this.snackBar.open(`Added ${rows.length || lines.length} phrasings`, 'Close', { duration: 3000 });
        // Refresh from server to ensure we have authoritative data
        this.loadPhrasings();
      },
      error: () => {
        this.isBulkAdding = false;
        this.snackBar.open('Bulk add failed', 'Close', { duration: 5000 });
      }
    });
  }

  truncate(s: string | undefined | null, max = 50): string {
    if (!s) return '';
    return s.length > max ? s.substring(0, max) + '...' : s;
  }
}
