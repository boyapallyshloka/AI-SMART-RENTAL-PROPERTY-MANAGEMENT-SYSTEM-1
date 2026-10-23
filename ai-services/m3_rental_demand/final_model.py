"""Compatibility entry point for the canonical M3 training script."""

from m3_rental_demand.train_model import main


def train_and_evaluate():
    main()


if __name__ == "__main__":
    train_and_evaluate()
