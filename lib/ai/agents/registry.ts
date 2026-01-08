import type { Agent, AgentConfig, AgentRole } from './base';

/**
 * Agent Registry
 *
 * Central registry for all agents in the Agentic Factory.
 * Provides methods to register, retrieve, and list agents.
 */

class AgentRegistryClass {
  private agents: Map<string, Agent> = new Map();
  private agentsByRole: Map<AgentRole, Agent[]> = new Map();

  /**
   * Register an agent
   */
  register(agent: Agent): void {
    const name = `vaf-${agent.config.role}`;

    if (this.agents.has(name)) {
      console.warn(`[AgentRegistry] Agent ${name} already registered, overwriting`);
    }

    this.agents.set(name, agent);

    // Also index by role
    const roleAgents = this.agentsByRole.get(agent.config.role) || [];
    roleAgents.push(agent);
    this.agentsByRole.set(agent.config.role, roleAgents);

    console.log(`[AgentRegistry] Registered agent: ${name}`);
  }

  /**
   * Get an agent by name
   */
  get(name: string): Agent | undefined {
    // Normalize name
    const normalizedName = name.startsWith('vaf-') ? name : `vaf-${name}`;
    return this.agents.get(normalizedName);
  }

  /**
   * Get agents by role
   */
  getByRole(role: AgentRole): Agent[] {
    return this.agentsByRole.get(role) || [];
  }

  /**
   * Check if an agent is registered
   */
  has(name: string): boolean {
    const normalizedName = name.startsWith('vaf-') ? name : `vaf-${name}`;
    return this.agents.has(normalizedName);
  }

  /**
   * List all registered agent names
   */
  list(): string[] {
    return Array.from(this.agents.keys());
  }

  /**
   * List all agent configs
   */
  listConfigs(): AgentConfig[] {
    return Array.from(this.agents.values()).map(a => a.config);
  }

  /**
   * Get agents that can approve a specific domain
   */
  getApprovers(domain: string): Agent[] {
    return Array.from(this.agents.values()).filter(
      agent => agent.config.canApprove.includes(domain) || agent.config.canApprove.includes('*')
    );
  }

  /**
   * Get agents that can review a specific domain
   */
  getReviewers(domain: string): Agent[] {
    return Array.from(this.agents.values()).filter(
      agent => agent.config.canReview.includes(domain) || agent.config.canReview.includes('*')
    );
  }

  /**
   * Get agents by authority level
   */
  getByAuthority(level: 'executive' | 'lead' | 'ic' | 'support'): Agent[] {
    return Array.from(this.agents.values()).filter(
      agent => agent.config.authorityLevel === level
    );
  }

  /**
   * Clear all registered agents (useful for testing)
   */
  clear(): void {
    this.agents.clear();
    this.agentsByRole.clear();
  }

  /**
   * Get registry stats
   */
  stats(): {
    totalAgents: number;
    byRole: Record<string, number>;
    byAuthority: Record<string, number>;
  } {
    const byRole: Record<string, number> = {};
    const byAuthority: Record<string, number> = {};

    for (const agent of this.agents.values()) {
      byRole[agent.config.role] = (byRole[agent.config.role] || 0) + 1;
      byAuthority[agent.config.authorityLevel] = (byAuthority[agent.config.authorityLevel] || 0) + 1;
    }

    return {
      totalAgents: this.agents.size,
      byRole,
      byAuthority,
    };
  }
}

// Singleton instance
export const AgentRegistry = new AgentRegistryClass();

// Also export the class for testing
export { AgentRegistryClass };
