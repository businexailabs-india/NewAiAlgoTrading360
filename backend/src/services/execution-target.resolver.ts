import { prisma } from '../config/database';
import { EncryptionService } from './encryption.service';
import { McpHttpClient } from './mcp-http.client';
import { DhanMcpAdapter } from './dhan-mcp.adapter';
import { DhanDirectAdapter } from './dhan-direct.adapter';
import { AppError } from '../middleware/error.middleware';
import { capabilityMatrixFromTools } from './dhan-capability.registry';

export interface ResolvedExecutionTarget {
  userId: string;
  executionMode: 'PAPER' | 'LIVE';
  brokerConnectionId: string | null;
  mcpServerConfigId: string | null;
  providerType: 'DIRECT' | 'MCP' | 'NONE';
  broker: string | null;
  displayName: string | null;
  capabilities: Record<string, boolean>;
  adapter: 'mcp' | 'direct' | 'paper';
  mcp?: DhanMcpAdapter;
  direct?: DhanDirectAdapter;
  credentials?: { clientId: string; accessToken: string };
}

function parseCredentials(connection: {
  clientIdEncrypted?: string | null;
  accessTokenEncrypted?: string | null;
  credentialsEncrypted?: string | null;
  apiKeyEncrypted?: string | null;
}): { clientId: string; accessToken: string } {
  const fromBundle = EncryptionService.decryptJson<{ clientId?: string; accessToken?: string }>(
    connection.credentialsEncrypted
  );
  const clientId =
    fromBundle?.clientId ||
    (connection.clientIdEncrypted ? EncryptionService.decrypt(connection.clientIdEncrypted) : '') ||
    (connection.apiKeyEncrypted ? EncryptionService.decrypt(connection.apiKeyEncrypted) : '');
  const accessToken =
    fromBundle?.accessToken ||
    (connection.accessTokenEncrypted ? EncryptionService.decrypt(connection.accessTokenEncrypted) : '');
  return { clientId, accessToken };
}

export class ExecutionTargetResolver {
  static async getOrCreateContext(userId: string) {
    return prisma.userExecutionContext.upsert({
      where: { userId },
      create: { userId, executionMode: 'PAPER' },
      update: {}
    });
  }

  static async setContext(
    userId: string,
    input: {
      activeBrokerConnectionId?: string | null;
      activeMcpServerConfigId?: string | null;
      executionMode?: 'PAPER' | 'LIVE';
      expectedVersion?: number;
    }
  ) {
    const ctx = await this.getOrCreateContext(userId);

    if (input.expectedVersion != null && input.expectedVersion !== ctx.version) {
      throw new AppError('Execution context version conflict — reload and retry', 409);
    }

    if (input.activeBrokerConnectionId) {
      const conn = await prisma.brokerConnection.findFirst({
        where: { id: input.activeBrokerConnectionId, userId, isActive: true, isEnabled: true }
      });
      if (!conn) throw new AppError('Broker account not found or disabled', 404);
    }

    if (input.activeMcpServerConfigId) {
      const mcp = await prisma.mcpServerConfig.findFirst({
        where: { id: input.activeMcpServerConfigId, userId, isEnabled: true }
      });
      if (!mcp) throw new AppError('MCP server config not found or disabled', 404);
    }

    return prisma.userExecutionContext.update({
      where: { userId },
      data: {
        ...(input.activeBrokerConnectionId !== undefined && {
          activeBrokerConnectionId: input.activeBrokerConnectionId
        }),
        ...(input.activeMcpServerConfigId !== undefined && {
          activeMcpServerConfigId: input.activeMcpServerConfigId
        }),
        ...(input.executionMode && { executionMode: input.executionMode }),
        version: { increment: 1 }
      },
      include: {
        activeBrokerConnection: true,
        activeMcpServerConfig: true
      }
    });
  }

  /**
   * Resolve the deterministic execution target for a user.
   * Optional overrideConnectionId must be owned by the user.
   */
  static async resolve(
    userId: string,
    options?: {
      brokerConnectionId?: string;
      requireLive?: boolean;
      preferPaper?: boolean;
    }
  ): Promise<ResolvedExecutionTarget> {
    const ctx = await this.getOrCreateContext(userId);
    const mode = options?.preferPaper
      ? 'PAPER'
      : (options?.requireLive ? 'LIVE' : (ctx.executionMode as 'PAPER' | 'LIVE'));

    if (mode === 'PAPER' && !options?.requireLive) {
      return {
        userId,
        executionMode: 'PAPER',
        brokerConnectionId: null,
        mcpServerConfigId: ctx.activeMcpServerConfigId,
        providerType: 'NONE',
        broker: null,
        displayName: 'Paper',
        capabilities: {},
        adapter: 'paper'
      };
    }

    const connectionId = options?.brokerConnectionId || ctx.activeBrokerConnectionId;
    if (!connectionId) {
      throw new AppError('No active broker account selected. Select an account in Admin/Accounts first.', 400);
    }

    const connection = await prisma.brokerConnection.findFirst({
      where: { id: connectionId, userId },
      include: { mcpServerConfig: true }
    });
    if (!connection) throw new AppError('Selected broker account not found', 404);
    if (!connection.isActive || !connection.isEnabled) {
      throw new AppError('Selected broker account is disabled', 400);
    }
    if (connection.status === 'ERROR' || connection.status === 'EXPIRED') {
      throw new AppError(`Selected account status is ${connection.status}`, 400);
    }

    const capabilities = (connection.capabilities as Record<string, boolean>) || {};
    const mcpConfig = connection.mcpServerConfig;

    if (connection.providerType === 'MCP' && mcpConfig) {
      const headers = EncryptionService.decryptJson<Record<string, string>>(mcpConfig.headersEncrypted) || {};
      const auth = EncryptionService.decryptJson<Record<string, string>>(mcpConfig.authConfigEncrypted) || {};
      const client = new McpHttpClient({
        endpoint: mcpConfig.endpoint,
        transport: mcpConfig.transport as 'HTTP' | 'SSE',
        headers: { ...headers, ...auth }
      });
      return {
        userId,
        executionMode: 'LIVE',
        brokerConnectionId: connection.id,
        mcpServerConfigId: mcpConfig.id,
        providerType: 'MCP',
        broker: connection.broker,
        displayName: connection.displayName || connection.broker,
        capabilities: capabilities || capabilityMatrixFromTools(
          Array.isArray(mcpConfig.discoveredTools)
            ? (mcpConfig.discoveredTools as Array<{ name?: string }>).map(t => t.name || '')
            : []
        ),
        adapter: 'mcp',
        mcp: new DhanMcpAdapter(client)
      };
    }

    const credentials = parseCredentials(connection);
    if (!credentials.clientId || !credentials.accessToken) {
      throw new AppError('Selected account has no usable Dhan credentials', 400);
    }

    return {
      userId,
      executionMode: 'LIVE',
      brokerConnectionId: connection.id,
      mcpServerConfigId: connection.mcpServerConfigId,
      providerType: 'DIRECT',
      broker: connection.broker,
      displayName: connection.displayName || connection.broker,
      capabilities,
      adapter: 'direct',
      direct: new DhanDirectAdapter(credentials),
      credentials
    };
  }
}
