import random
import logging
import copy
from typing import Any, Dict, List, Optional, Tuple, Callable
from backtesting.runner import BacktestResult, BacktestRunner
from backtesting.optimizer import OptimizationResult

logger = logging.getLogger(__name__)

class GeneticOptimizer:
    """
    Optimizes strategy parameters using a Genetic Algorithm (GA).
    Effective for large parameter spaces where Grid Search is too slow.
    """

    def __init__(
        self,
        runner: Optional[BacktestRunner] = None,
        population_size: int = 20,
        generations: int = 5,
        mutation_rate: float = 0.2,
        crossover_rate: float = 0.7,
        tournament_size: int = 3
    ):
        self.runner = runner or BacktestRunner()
        self.population_size = population_size
        self.generations = generations
        self.mutation_rate = mutation_rate
        self.crossover_rate = crossover_rate
        self.tournament_size = tournament_size
        self.cache: Dict[str, float] = {} # param_string -> fitness

    def optimize(
        self,
        strategy_key: str,
        symbol: str,
        candles: List[Dict[str, Any]],
        param_ranges: Dict[str, List[Any]],
        metric: str = "net_pnl"
    ) -> OptimizationResult:
        """
        Run the Genetic Algorithm.
        """
        # 1. Initialize Population
        population = self._initialize_population(param_ranges)
        best_overall_individual = None
        best_overall_fitness = float("-inf")
        all_runs = []

        logger.info(
            "Starting Genetic Optimization for %s on %s. Pop size: %d, Gen: %d",
            strategy_key, symbol, self.population_size, self.generations
        )

        for gen in range(self.generations):
            # 2. Evaluate Fitness
            fitness_scores = []
            for individual in population:
                fitness, result = self._evaluate_fitness(
                    individual, strategy_key, symbol, candles, metric
                )
                fitness_scores.append(fitness)

                if result:
                    all_runs.append({
                        "params": individual,
                        "result_id": result.result_id,
                        "net_pnl": result.net_pnl,
                        "win_rate": result.win_rate,
                        "max_drawdown": result.max_drawdown,
                        "fitness": fitness
                    })

                if fitness > best_overall_fitness:
                    best_overall_fitness = fitness
                    best_overall_individual = individual

            logger.info(f"Generation {gen}: Best Fitness = {best_overall_fitness:.2f}")

            # 3. Selection & Reproduction
            new_population = []

            # Elitism: Keep the best individual
            new_population.append(best_overall_individual)

            while len(new_population) < self.population_size:
                # Selection
                parent1 = self._tournament_selection(population, fitness_scores)
                parent2 = self._tournament_selection(population, fitness_scores)

                # Crossover
                if random.random() < self.crossover_rate:
                    child = self._crossover(parent1, parent2)
                else:
                    child = copy.deepcopy(parent1)

                # Mutation
                if random.random() < self.mutation_rate:
                    child = self._mutate(child, param_ranges)

                new_population.append(child)

            population = new_population

        # Sort all runs for the final result
        all_runs.sort(key=lambda x: x.get("fitness", 0.0), reverse=True)

        return OptimizationResult(
            best_params=best_overall_individual,
            best_pnl=best_overall_fitness,
            all_runs=all_runs,
            metric_used=metric
        )

    def _initialize_population(self, param_ranges: Dict[str, List[Any]]) -> List[Dict[str, Any]]:
        population = []
        for _ in range(self.population_size):
            individual = {}
            for param, values in param_ranges.items():
                individual[param] = random.choice(values)
            population.append(individual)
        return population

    def _evaluate_fitness(
        self,
        individual: Dict[str, Any],
        strategy_key: str,
        symbol: str,
        candles: List[Dict[str, Any]],
        metric: str
    ) -> Tuple[float, Optional[BacktestResult]]:

        # Check cache
        param_key = str(sorted(individual.items()))
        if param_key in self.cache:
            return self.cache[param_key], None

        try:
            result = self.runner.run(
                strategy_key=strategy_key,
                symbol=symbol,
                candles=candles,
                params=individual
            )
            fitness = getattr(result, metric, 0.0)

            # Penalty for excessive drawdown (Institutional requirement)
            if result.max_drawdown > 20: # 20% drawdown limit
                fitness *= (1 - (result.max_drawdown / 100))

            self.cache[param_key] = fitness
            return fitness, result
        except Exception:
            logger.error("Fitness evaluation failed", exc_info=True)
            return -999999.0, None

    def _tournament_selection(self, population: List[Dict[str, Any]], scores: List[float]) -> Dict[str, Any]:
        selection_indices = random.sample(range(len(population)), min(self.tournament_size, len(population)))
        best_index = selection_indices[0]
        best_score = scores[best_index]

        for idx in selection_indices[1:]:
            if scores[idx] > best_score:
                best_score = scores[idx]
                best_index = idx

        return copy.deepcopy(population[best_index])

    def _crossover(self, parent1: Dict[str, Any], parent2: Dict[str, Any]) -> Dict[str, Any]:
        child = {}
        keys = list(parent1.keys())
        crossover_point = random.randint(1, len(keys) - 1) if len(keys) > 1 else 0

        for i, key in enumerate(keys):
            if i < crossover_point:
                child[key] = parent1[key]
            else:
                child[key] = parent2[key]
        return child

    def _mutate(self, individual: Dict[str, Any], param_ranges: Dict[str, List[Any]]) -> Dict[str, Any]:
        mutated = copy.deepcopy(individual)
        param_to_mutate = random.choice(list(mutated.keys()))
        mutated[param_to_mutate] = random.choice(param_ranges[param_to_mutate])
        return mutated
