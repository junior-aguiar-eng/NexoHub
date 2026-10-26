"""Controles de avaliação: valores ausentes não podem virar acertos."""

import importlib.util
import unittest
from pathlib import Path

spec = importlib.util.spec_from_file_location(
    "benchmark", Path(__file__).with_name("comparar-xl-c1-isolado.py")
)
benchmark = importlib.util.module_from_spec(spec)
spec.loader.exec_module(benchmark)


class CellQualityTests(unittest.TestCase):
    def setUp(self):
        self.expected = [["Código", "Produto", "Valor"], ["00123", "", "1.234,56"]]

    def test_exact(self):
        result = benchmark.score_cells(self.expected, self.expected)
        self.assertEqual(result["correct"], 6)
        self.assertEqual(result["extraCells"], 0)

    def test_missing_table_does_not_count_empty_cell(self):
        self.assertEqual(benchmark.score_cells([], self.expected)["correct"], 0)

    def test_no_numeric_or_decimal_repair(self):
        actual = [self.expected[0], ["123", "", "1234.56"]]
        self.assertEqual(benchmark.score_cells(actual, self.expected)["correct"], 4)

    def test_extra_header_remains_visible_and_strict_fails(self):
        result = benchmark.score_cells(
            [["Título", "", ""], *self.expected], self.expected
        )
        self.assertEqual(result["correct"], 6)
        self.assertEqual(result["strictCorrect"], 0)
        self.assertEqual(result["extraCells"], 3)
        self.assertEqual(result["headerOffset"], 1)

    def test_missing_column_is_not_shifted(self):
        self.assertEqual(
            benchmark.score_cells(
                [self.expected[0], ["00123", "1.234,56"]], self.expected
            )["correct"],
            4,
        )


if __name__ == "__main__":
    unittest.main()
