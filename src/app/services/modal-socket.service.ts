// src/app/services/modal-socket.service.ts
import { Injectable }  from '@angular/core';
import { Socket }      from 'socket.io-client';
import { Subject }     from 'rxjs';
import { createSocket } from '../shared/utils/socket-factory';

export interface AgentStatus {
  connected: boolean;
  agentId: string | null;
}

@Injectable({ providedIn: 'root' })
export class ModalSocketService {
  private socket: Socket | null = null;
  private readonly MODAL_NS = '/modal';

  // Subjects publics pour que le composant puisse s'abonner
  readonly scriptLine$        = new Subject<{ line: string }>();
  readonly recordingEvent$    = new Subject<any>();
  readonly recordingStarted$  = new Subject<{ message: string }>();
  readonly recordingStopped$  = new Subject<{ script: string; events: any[] }>();
  readonly recordingError$    = new Subject<{ message: string }>();
  readonly agentStatus$       = new Subject<AgentStatus>();
  readonly associationOk$     = new Subject<{ agentId: string }>();
  readonly associationError$  = new Subject<{ message: string }>();

  connect(serverUrl: string): void {
    if (this.socket?.connected) return;

    this.socket = createSocket(`${serverUrl}${this.MODAL_NS}`, {
      transports: ['websocket'],
      reconnection: true,
      reconnectionDelay: 3000,
    });

    // Brancher tous les événements sur les Subjects
    this.socket.on('recording_started',  (d) => this.recordingStarted$.next(d));
    this.socket.on('script_line',        (d) => this.scriptLine$.next(d));
    this.socket.on('recording_event',    (d) => this.recordingEvent$.next(d));
    this.socket.on('recording_stopped',  (d) => this.recordingStopped$.next(d));
    this.socket.on('recording_error',    (d) => this.recordingError$.next(d));
    this.socket.on('agent_status',       (d) => this.agentStatus$.next(d));
    this.socket.on('association_ok',     (d) => this.associationOk$.next(d));
    this.socket.on('association_error',  (d) => this.associationError$.next(d));
  }

  emit(event: string, data: unknown): void {
    this.socket?.emit(event, data);
  }

  checkAgent(agentToken: string): void {
    this.emit('modal_check_agent', { agentToken });
  }

  associateAgent(agentToken: string): void {
    this.emit('modal_associate_agent', { agentToken });
  }

  startRecording(payload: {
    agentToken: string;
    scenarioName: string;
    startUrl: string;
    browser: string;
  }): void {
    this.emit('start_recording', payload);
  }

  stopRecording(agentToken: string): void {
    this.emit('stop_recording', { agentToken });
  }

  disconnect(): void {
    this.socket?.disconnect();
    this.socket = null;
  }

  get isConnected(): boolean {
    return this.socket?.connected ?? false;
  }
}
