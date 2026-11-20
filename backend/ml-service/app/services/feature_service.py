"""A shared, data-independent nonlinear basis for federated logistic models."""

import numpy as np
from sklearn.base import BaseEstimator, TransformerMixin
from sklearn.kernel_approximation import RBFSampler


class SharedFeatureMap(TransformerMixin, BaseEstimator):
    """Preserve the eight inputs and append reproducible random Fourier features.

    Basis vectors come from a public seed, never patient landmarks. Every client
    uses the same map. Training statistics are still pooled in this simulator.
    """

    def __init__(self, gamma: float = 0.1, n_components: int = 64, random_state: int = 42):
        self.gamma = gamma
        self.n_components = n_components
        self.random_state = random_state

    def fit(self, X, y=None):
        self.n_features_in_ = X.shape[1]
        self.basis_ = RBFSampler(
            gamma=self.gamma, n_components=self.n_components, random_state=self.random_state,
        ).fit(np.zeros((1, self.n_features_in_)))
        return self

    def transform(self, X):
        return np.column_stack([X, 4.0 * self.basis_.transform(X)])
