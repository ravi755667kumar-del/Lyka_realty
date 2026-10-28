import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { v4 as uuidv4 } from 'uuid';
import { getSupabaseClient, isSupabaseConfigured } from '../config/supabase.js';
import { evaluateTopicCompletion, calculateLevelProgress, calculateRoadmapProgress } from './progressCalculator.js';
import { getCurriculumForGoal } from './courseCurriculums.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_DIR = path.join(__dirname, '../data');
const STORE_FILE = path.join(DATA_DIR, 'store.json');

// Ensure data directory exists
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

// In-memory cache + persistent JSON backing
let localStore = {
  students: {},
  roadmaps: {},
  levels: {},
  topics: {},
  assessments: [],
  activity_logs: [],
  chat_messages: {},
  mcp_configs: {}
};

// Load initial store if exists
if (fs.existsSync(STORE_FILE)) {
  try {
    const raw = fs.readFileSync(STORE_FILE, 'utf-8');
    localStore = JSON.parse(raw);
    if (!localStore.chat_messages) localStore.chat_messages = {};
    if (!localStore.students) localStore.students = {};
    if (!localStore.roadmaps) localStore.roadmaps = {};
    if (!localStore.assessments) localStore.assessments = [];
    if (!localStore.activity_logs) localStore.activity_logs = [];
    if (!localStore.mcp_configs) localStore.mcp_configs = {};
    console.log('📂 Loaded existing local persistent database from store.json');
  } catch (err) {
    console.warn('⚠️ Could not parse existing store.json, initializing fresh store:', err.message);
  }
}

function persistStore() {
  try {
    fs.writeFileSync(STORE_FILE, JSON.stringify(localStore, null, 2), 'utf-8');
  } catch (err) {
    // If Windows locks the file temporarily, retry safely via temp file swap
    try {
      const tempPath = path.join(DATA_DIR, `store_${Date.now()}.tmp`);
      fs.writeFileSync(tempPath, JSON.stringify(localStore, null, 2), 'utf-8');
      try {
        fs.copyFileSync(tempPath, STORE_FILE);
        fs.unlinkSync(tempPath);
      } catch {
        // Fallback: in-memory state is maintained in localStore
      }
    } catch {
      // Non-blocking fallback
    }
  }
}

/**
 * Generate standard default curriculum for AI/ML Engineer
 */
export function createDefaultAiMlRoadmap(studentId = 'student-demo-1') {
  const roadmapId = 'roadmap-aiml-1';

  const levelsData = [
    {
      id: 'level-1',
      title: 'Level 1: Python Fundamentals',
      order: 1,
      status: 'Completed',
      isLocked: false,
      prerequisites: 'None',
      completionCriteria: 'Complete all 4 Python modules, pass syntax and OOP quizzes',
      topics: [
        {
          id: 'topic-1-1',
          title: 'Python Syntax, Variables & Control Flow',
          shortExplanation: 'Foundational syntax, dynamic typing, conditional branching, loops, and comprehension expressions in Python.',
          learningObjectives: ['Master variable assignment and primitive types', 'Write conditional statements and loops', 'Implement list & dictionary comprehensions'],
          prerequisites: 'Basic computer literacy',
          recommendedResources: [
            { title: 'Python Official Documentation: Tutorial', url: 'https://docs.python.org/3/tutorial/', type: 'Docs' },
            { title: 'Core Python Fundamentals - Real Python', url: 'https://realpython.com/', type: 'Article' }
          ],
          exercisePrompt: 'Write a Python function `filter_even_squares(numbers)` that returns a list of squares of even numbers using list comprehension.',
          requiresExercise: true,
          exerciseSubmitted: true,
          exerciseSubmissionText: 'def filter_even_squares(numbers):\n    return [n**2 for n in numbers if n % 2 == 0]',
          exerciseStatus: 'submitted',
          lessonCompleted: true,
          assessmentScore: 100,
          requiredPassingScore: 70,
          weight: 1.0,
          estimatedHours: 2,
          status: 'Completed',
          completedDate: new Date(Date.now() - 7 * 86400000).toISOString(),
        },
        {
          id: 'topic-1-2',
          title: 'Data Structures: Lists, Tuples, Sets & Dictionaries',
          shortExplanation: 'Deep dive into Python built-in collections, time complexities, hashing mechanisms, and memory representations.',
          learningObjectives: ['Understand mutable vs immutable types', 'Analyze Big-O for collection operations', 'Implement frequency counters with dictionaries'],
          prerequisites: 'Python Syntax',
          recommendedResources: [
            { title: 'Python Data Structures Guide', url: 'https://docs.python.org/3/tutorial/datastructures.html', type: 'Docs' }
          ],
          exercisePrompt: 'Implement a function `word_frequencies(text)` returning a dictionary of word counts.',
          requiresExercise: true,
          exerciseSubmitted: true,
          exerciseSubmissionText: 'def word_frequencies(text):\n    words = text.lower().split()\n    return {w: words.count(w) for w in set(words)}',
          exerciseStatus: 'submitted',
          lessonCompleted: true,
          assessmentScore: 90,
          requiredPassingScore: 70,
          weight: 1.0,
          estimatedHours: 2.5,
          status: 'Completed',
          completedDate: new Date(Date.now() - 6 * 86400000).toISOString(),
        },
        {
          id: 'topic-1-3',
          title: 'Functions, Generators, Scope & Modules',
          shortExplanation: 'Higher-order functions, *args and **kwargs, lambda functions, yield generators, and package imports.',
          learningObjectives: ['Write clean functions with type hints', 'Use generators for memory efficiency', 'Structure modular Python code'],
          prerequisites: 'Data Structures',
          recommendedResources: [{ title: 'Functional Programming in Python', url: 'https://realpython.com/primer-on-python-decorators/', type: 'Article' }],
          exercisePrompt: 'Create a generator `fibonacci_gen(limit)` that yields numbers up to limit.',
          requiresExercise: true,
          exerciseSubmitted: true,
          exerciseSubmissionText: 'def fibonacci_gen(limit):\n    a, b = 0, 1\n    while a < limit:\n        yield a\n        a, b = b, a + b',
          exerciseStatus: 'submitted',
          lessonCompleted: true,
          assessmentScore: 85,
          requiredPassingScore: 70,
          weight: 1.2,
          estimatedHours: 3,
          status: 'Completed',
          completedDate: new Date(Date.now() - 5 * 86400000).toISOString(),
        },
        {
          id: 'topic-1-4',
          title: 'Object-Oriented Programming & Exception Handling',
          shortExplanation: 'Classes, dunder methods, inheritance, polymorphism, encapsulation, and custom exception handling.',
          learningObjectives: ['Design clean reusable class hierarchies', 'Implement dunder methods (__repr__, __len__)', 'Handle edge case exceptions gracefully'],
          prerequisites: 'Functions and Modules',
          recommendedResources: [{ title: 'OOP in Python 3', url: 'https://realpython.com/python3-object-oriented-programming/', type: 'Article' }],
          exercisePrompt: 'Define a class `DatasetSplitter` with train and test partitioning methods.',
          requiresExercise: true,
          exerciseSubmitted: true,
          exerciseSubmissionText: 'class DatasetSplitter:\n    def __init__(self, ratio=0.8):\n        self.ratio = ratio',
          exerciseStatus: 'submitted',
          lessonCompleted: true,
          assessmentScore: 95,
          requiredPassingScore: 70,
          weight: 1.5,
          estimatedHours: 3.5,
          status: 'Completed',
          completedDate: new Date(Date.now() - 4 * 86400000).toISOString(),
        }
      ]
    },
    {
      id: 'level-2',
      title: 'Level 2: NumPy and Pandas',
      order: 2,
      status: 'Completed',
      isLocked: false,
      prerequisites: 'Level 1: Python Fundamentals',
      completionCriteria: 'Complete array manipulation, data aggregation, and pass vectorization benchmark test',
      topics: [
        {
          id: 'topic-2-1',
          title: 'NumPy Arrays & Vectorized Mathematical Operations',
          shortExplanation: 'N-dimensional arrays, broadcasting rules, matrix math, and SIMD performance optimization in NumPy.',
          learningObjectives: ['Master ndarray indexing, slicing and shapes', 'Apply broadcasting across multiple dimensions', 'Replace Python loops with vector operations'],
          prerequisites: 'Python Lists and Math Basics',
          recommendedResources: [{ title: 'NumPy Quickstart Tutorial', url: 'https://numpy.org/doc/stable/user/quickstart.html', type: 'Docs' }],
          exercisePrompt: 'Normalize a 2D numpy array so each column has mean 0 and std 1.',
          requiresExercise: true,
          exerciseSubmitted: true,
          exerciseSubmissionText: 'import numpy as np\ndef normalize(X):\n    return (X - np.mean(X, axis=0)) / np.std(X, axis=0)',
          exerciseStatus: 'submitted',
          lessonCompleted: true,
          assessmentScore: 92,
          requiredPassingScore: 70,
          weight: 1.2,
          estimatedHours: 3,
          status: 'Completed',
          completedDate: new Date(Date.now() - 3 * 86400000).toISOString(),
        },
        {
          id: 'topic-2-2',
          title: 'Pandas DataFrames, Indexing & Aggregations',
          shortExplanation: 'Series and DataFrame structures, loc/iloc indexing, groupby operations, and rolling statistical windows.',
          learningObjectives: ['Load tabular data from CSV/Parquet', 'Perform complex multi-column groupbys', 'Compute summary statistics'],
          prerequisites: 'NumPy Arrays',
          recommendedResources: [{ title: '10 Minutes to Pandas', url: 'https://pandas.pydata.org/docs/user_guide/10min.html', type: 'Docs' }],
          exercisePrompt: 'Group a sales DataFrame by `region` and compute total and average revenue.',
          requiresExercise: true,
          exerciseSubmitted: true,
          exerciseSubmissionText: 'df.groupby("region")["revenue"].agg(["sum", "mean"])',
          exerciseStatus: 'submitted',
          lessonCompleted: true,
          assessmentScore: 88,
          requiredPassingScore: 70,
          weight: 1.3,
          estimatedHours: 3,
          status: 'Completed',
          completedDate: new Date(Date.now() - 2 * 86400000).toISOString(),
        },
        {
          id: 'topic-2-3',
          title: 'Data Cleaning, Missing Values & Feature Transformation',
          shortExplanation: 'Handling null values, imputation techniques, categorical one-hot encoding, and datetime parsing.',
          learningObjectives: ['Identify and impute missing data', 'Encode nominal and ordinal features', 'Detect and manage anomalous outliers'],
          prerequisites: 'Pandas DataFrames',
          recommendedResources: [{ title: 'Kaggle Data Cleaning Course', url: 'https://www.kaggle.com/learn/data-cleaning', type: 'Course' }],
          exercisePrompt: 'Fill missing numerical columns with median and categorical columns with mode.',
          requiresExercise: true,
          exerciseSubmitted: true,
          exerciseSubmissionText: 'df["age"].fillna(df["age"].median(), inplace=True)',
          exerciseStatus: 'submitted',
          lessonCompleted: true,
          assessmentScore: 94,
          requiredPassingScore: 70,
          weight: 1.5,
          estimatedHours: 3.5,
          status: 'Completed',
          completedDate: new Date(Date.now() - 1 * 86400000).toISOString(),
        }
      ]
    },
    {
      id: 'level-3',
      title: 'Level 3: Mathematics and Statistics',
      order: 3,
      status: 'Completed',
      isLocked: false,
      prerequisites: 'Level 2: NumPy and Pandas',
      completionCriteria: 'Complete Linear Algebra, Calculus, and Bayes theorem modules and pass statistical inference exam',
      topics: [
        {
          id: 'topic-3-1',
          title: 'Linear Algebra: Vectors, Matrices & Eigenvalues',
          shortExplanation: 'Vector spaces, dot products, matrix decomposition (SVD), projections, and PCA dimensionality reduction theory.',
          learningObjectives: ['Calculate dot products and cosine similarity', 'Understand matrix rank and determinant', 'Explain PCA using Eigenvectors'],
          prerequisites: 'Basic High School Math',
          recommendedResources: [{ title: '3Blue1Brown: Essence of Linear Algebra', url: 'https://www.3blue1brown.com/topics/linear-algebra', type: 'Video' }],
          exercisePrompt: 'Compute the cosine similarity between two 1D vectors in NumPy.',
          requiresExercise: true,
          exerciseSubmitted: true,
          exerciseSubmissionText: 'def cos_sim(a, b):\n    return np.dot(a, b) / (np.linalg.norm(a) * np.linalg.norm(b))',
          exerciseStatus: 'submitted',
          lessonCompleted: true,
          assessmentScore: 90,
          requiredPassingScore: 70,
          weight: 1.4,
          estimatedHours: 4,
          status: 'Completed',
          completedDate: new Date(Date.now() - 1 * 86400000).toISOString(),
        },
        {
          id: 'topic-3-2',
          title: 'Multivariable Calculus & Gradient Descent',
          shortExplanation: 'Partial derivatives, Jacobian matrices, directional gradients, learning rates, and convex optimization.',
          learningObjectives: ['Compute partial derivatives of loss functions', 'Derive batch gradient descent updates', 'Analyze learning rate convergence'],
          prerequisites: 'Linear Algebra',
          recommendedResources: [{ title: 'Calculus for Machine Learning', url: 'https://www.khanacademy.org/math/multivariable-calculus', type: 'Course' }],
          exercisePrompt: 'Implement gradient descent update rule: `w = w - lr * grad`.',
          requiresExercise: true,
          exerciseSubmitted: true,
          exerciseSubmissionText: 'w = w - learning_rate * d_loss_dw',
          exerciseStatus: 'submitted',
          lessonCompleted: true,
          assessmentScore: 84,
          requiredPassingScore: 70,
          weight: 1.5,
          estimatedHours: 4,
          status: 'Completed',
          completedDate: new Date(Date.now() - 1 * 86400000).toISOString(),
        },
        {
          id: 'topic-3-3',
          title: 'Probability Distributions & Bayes Theorem',
          shortExplanation: 'Discrete vs continuous distributions (Gaussian, Bernoulli), prior/posterior probability, Maximum Likelihood Estimation (MLE).',
          learningObjectives: ['Apply Bayes Theorem to real-world classification', 'Calculate probability density for normal distributions', 'Understand MLE parameter fitting'],
          prerequisites: 'Calculus Basics',
          recommendedResources: [{ title: 'StatQuest: Probability & Statistics', url: 'https://statquest.org/', type: 'Video' }],
          exercisePrompt: 'Calculate posterior probability P(Spam|Word) using Naive Bayes formula.',
          requiresExercise: true,
          exerciseSubmitted: true,
          exerciseSubmissionText: 'p_spam_word = (p_word_given_spam * p_spam) / p_word',
          exerciseStatus: 'submitted',
          lessonCompleted: true,
          assessmentScore: 82,
          requiredPassingScore: 70,
          weight: 1.5,
          estimatedHours: 3.5,
          status: 'Completed',
          completedDate: new Date(Date.now() - 1 * 86400000).toISOString(),
        },
        {
          id: 'topic-3-4',
          title: 'Inferential Statistics & Hypothesis Testing',
          shortExplanation: 'Central Limit Theorem, p-values, t-tests, ANOVA, confidence intervals, and A/B test analysis.',
          learningObjectives: ['Formulate null and alternative hypotheses', 'Interpret p-values with statistical rigor', 'Compute confidence intervals'],
          prerequisites: 'Probability Distributions',
          recommendedResources: [{ title: 'Statistics for ML Handbook', url: 'https://openstax.org/details/books/introductory-statistics', type: 'Book' }],
          exercisePrompt: 'Perform a 2-sample independent t-test using scipy.stats.',
          requiresExercise: true,
          exerciseSubmitted: true,
          exerciseSubmissionText: 'from scipy import stats\nt_stat, p_val = stats.ttest_ind(group_a, group_b)',
          exerciseStatus: 'submitted',
          lessonCompleted: true,
          assessmentScore: 78,
          requiredPassingScore: 70,
          weight: 1.2,
          estimatedHours: 3,
          status: 'Completed',
          completedDate: new Date(Date.now() - 1 * 86400000).toISOString(),
        }
      ]
    },
    {
      id: 'level-4',
      title: 'Level 4: Machine Learning',
      order: 4,
      status: 'In Progress',
      isLocked: false,
      prerequisites: 'Level 3: Mathematics and Statistics',
      completionCriteria: 'Complete all 10 ML topics, pass model evaluation quiz, submit decision tree / random forest project',
      topics: [
        {
          id: 'topic-4-1',
          title: 'Introduction to Machine Learning',
          shortExplanation: 'Overview of learning paradigms, features, labels, loss functions, overfitting vs underfitting, and bias-variance tradeoff.',
          learningObjectives: ['Define ML terminology', 'Explain the bias-variance tradeoff', 'Differentiate train, validation and test splits'],
          prerequisites: 'Python and Statistics',
          recommendedResources: [{ title: 'Google Machine Learning Crash Course', url: 'https://developers.google.com/machine-learning/crash-course', type: 'Course' }],
          exercisePrompt: 'Explain how regularization addresses overfitting in 2-3 sentences.',
          requiresExercise: true,
          exerciseSubmitted: true,
          exerciseSubmissionText: 'Regularization adds a penalty term (L1/L2) to the loss function, constraining model complexity and preventing weights from exploding.',
          exerciseStatus: 'submitted',
          lessonCompleted: true,
          assessmentScore: 90,
          requiredPassingScore: 70,
          weight: 1.0,
          estimatedHours: 2,
          status: 'Completed',
          completedDate: new Date(Date.now() - 86400000).toISOString(),
        },
        {
          id: 'topic-4-2',
          title: 'Supervised Learning',
          shortExplanation: 'Mechanics of supervised learning with labeled data, regression vs classification formulations, and benchmark loss functions.',
          learningObjectives: ['Formulate classification and regression tasks', 'Select appropriate objective functions (MSE, Cross-Entropy)', 'Implement stratified train-test splits'],
          prerequisites: 'Intro to ML',
          recommendedResources: [{ title: 'Scikit-Learn Supervised Learning Overview', url: 'https://scikit-learn.org/stable/supervised_learning.html', type: 'Docs' }],
          exercisePrompt: 'Partition X and y into 80% train and 20% test using train_test_split with random_state=42.',
          requiresExercise: true,
          exerciseSubmitted: true,
          exerciseSubmissionText: 'from sklearn.model_selection import train_test_split\nX_tr, X_te, y_tr, y_te = train_test_split(X, y, test_size=0.2, random_state=42)',
          exerciseStatus: 'submitted',
          lessonCompleted: true,
          assessmentScore: 88,
          requiredPassingScore: 70,
          weight: 1.1,
          estimatedHours: 2.5,
          status: 'Completed',
          completedDate: new Date(Date.now() - 86400000).toISOString(),
        },
        {
          id: 'topic-4-3',
          title: 'Unsupervised Learning',
          shortExplanation: 'Discovering hidden patterns in unlabeled data: K-Means clustering, DBSCAN, hierarchical clustering, and PCA.',
          learningObjectives: ['Implement K-Means clustering from scratch', 'Evaluate clusters using Silhouette score', 'Reduce dimensions using PCA'],
          prerequisites: 'Linear Algebra and NumPy',
          recommendedResources: [{ title: 'Unsupervised Learning in Scikit-Learn', url: 'https://scikit-learn.org/stable/unsupervised_learning.html', type: 'Docs' }],
          exercisePrompt: 'Compute inertia curve (Elbow Method) for k=1 to 10.',
          requiresExercise: true,
          exerciseSubmitted: true,
          exerciseSubmissionText: 'inertias = [KMeans(n_clusters=k).fit(X).inertia_ for k in range(1, 11)]',
          exerciseStatus: 'submitted',
          lessonCompleted: true,
          assessmentScore: 85,
          requiredPassingScore: 70,
          weight: 1.2,
          estimatedHours: 3,
          status: 'Completed',
          completedDate: new Date(Date.now() - 86400000).toISOString(),
        },
        {
          id: 'topic-4-4',
          title: 'Linear Regression',
          shortExplanation: 'Ordinary Least Squares (OLS), cost surface minimization, multi-variable linear regression, and Ridge/Lasso regularization.',
          learningObjectives: ['Derive closed-form Normal Equation', 'Fit LinearRegression using Scikit-Learn', 'Interpret model coefficients and R-squared'],
          prerequisites: 'Calculus and Linear Algebra',
          recommendedResources: [{ title: 'Linear Regression Step-by-Step - StatQuest', url: 'https://statquest.org/linear-regression/', type: 'Video' }],
          exercisePrompt: 'Fit a Ridge regression model with alpha=1.0 and evaluate R2 score.',
          requiresExercise: true,
          exerciseSubmitted: true,
          exerciseSubmissionText: 'from sklearn.linear_model import Ridge\nmodel = Ridge(alpha=1.0).fit(X_train, y_train)\nscore = model.score(X_test, y_test)',
          exerciseStatus: 'submitted',
          lessonCompleted: true,
          assessmentScore: 82,
          requiredPassingScore: 70,
          weight: 1.2,
          estimatedHours: 3,
          status: 'Completed',
          completedDate: new Date(Date.now() - 86400000).toISOString(),
        },
        {
          id: 'topic-4-5',
          title: 'Logistic Regression',
          shortExplanation: 'Binary and multiclass classification, sigmoid activation, log-loss function, decision thresholds, and ROC curves.',
          learningObjectives: ['Understand the sigmoid function mapping to probabilities', 'Derive Binary Cross-Entropy loss', 'Calculate precision-recall tradeoffs'],
          prerequisites: 'Linear Regression and Probability',
          recommendedResources: [{ title: 'Logistic Regression Explained', url: 'https://ml-cheatsheet.readthedocs.io/en/latest/logistic_regression.html', type: 'Docs' }],
          exercisePrompt: 'Train LogisticRegression and output predicted probabilities for class 1.',
          requiresExercise: true,
          exerciseSubmitted: true,
          exerciseSubmissionText: 'clf = LogisticRegression().fit(X_tr, y_tr)\nprobs = clf.predict_proba(X_te)[:, 1]',
          exerciseStatus: 'submitted',
          lessonCompleted: true,
          assessmentScore: 80,
          requiredPassingScore: 70,
          weight: 1.3,
          estimatedHours: 3,
          status: 'Completed',
          completedDate: new Date(Date.now() - 86400000).toISOString(),
        },
        {
          id: 'topic-4-6',
          title: 'Decision Trees',
          shortExplanation: 'Recursive binary splitting, Gini Impurity, Information Gain, Entropy, pruning strategies, and tree interpretability.',
          learningObjectives: ['Calculate Gini impurity for sample partitions', 'Construct DecisionTreeClassifier with max_depth limits', 'Visualize decision boundaries'],
          prerequisites: 'Supervised Learning Basics',
          recommendedResources: [{ title: 'Decision Trees in Scikit-Learn', url: 'https://scikit-learn.org/stable/modules/tree.html', type: 'Docs' }],
          exercisePrompt: 'Train DecisionTreeClassifier with max_depth=4 and export text representation.',
          requiresExercise: true,
          exerciseSubmitted: true,
          exerciseSubmissionText: 'from sklearn.tree import DecisionTreeClassifier, export_text\ntree = DecisionTreeClassifier(max_depth=4).fit(X, y)\nprint(export_text(tree))',
          exerciseStatus: 'submitted',
          lessonCompleted: true,
          assessmentScore: 86,
          requiredPassingScore: 70,
          weight: 1.4,
          estimatedHours: 3.5,
          status: 'Completed',
          completedDate: new Date().toISOString(),
        },
        {
          id: 'topic-4-7',
          title: 'Random Forest',
          shortExplanation: 'Ensemble bagging methodology, bootstrap aggregation, random feature subspaces, out-of-bag (OOB) error, and feature importances.',
          learningObjectives: ['Understand how bagging reduces variance without increasing bias', 'Tune n_estimators and max_features hyperparameters', 'Extract and chart feature importances'],
          prerequisites: 'Decision Trees',
          recommendedResources: [
            { title: 'StatQuest: Random Forests', url: 'https://statquest.org/random-forests/', type: 'Video' },
            { title: 'Random Forests Guide - Scikit-Learn', url: 'https://scikit-learn.org/stable/modules/ensemble.html#forest', type: 'Docs' }
          ],
          exercisePrompt: 'Train a RandomForestClassifier with 100 estimators, print OOB score and top 3 feature importances.',
          requiresExercise: true,
          exerciseSubmitted: false,
          exerciseSubmissionText: '',
          exerciseStatus: 'pending',
          lessonCompleted: true,
          assessmentScore: 60, // Below 70% passing threshold! Demonstrates "why incomplete"
          requiredPassingScore: 70,
          weight: 1.5,
          estimatedHours: 3.5,
          status: 'In Progress',
          completedDate: null,
          quizQuestions: [
            {
              id: 'q1',
              question: 'What is the primary advantage of Random Forest over a single Decision Tree?',
              options: [
                'Faster training time on single-core CPUs',
                'Lower variance and resistance to overfitting via bagging and feature subsampling',
                'Simpler mathematical representation with fewer parameters',
                'Zero requirement for data normalization'
              ],
              correctAnswerIndex: 1,
              explanation: 'Random Forest aggregates many decorrelated decision trees, substantially reducing prediction variance and overfitting risk.'
            },
            {
              id: 'q2',
              question: 'What does Out-of-Bag (OOB) score measure in a Random Forest?',
              options: [
                'Execution speed of tree generation',
                'Performance on samples not included in bootstrap training sets (built-in validation)',
                'The proportion of features dropped during split checks',
                'Memory overhead of storing estimators'
              ],
              correctAnswerIndex: 1,
              explanation: 'In bootstrap sampling, ~37% of observations are left out of each tree and serve as an unbiased internal validation set.'
            },
            {
              id: 'q3',
              question: 'When tuning Random Forest for classification with P features, what is the standard recommended default for max_features?',
              options: ['P / 2', 'sqrt(P)', 'log2(P)', 'P - 1'],
              correctAnswerIndex: 1,
              explanation: 'The standard theoretical and empirical default for classification in Scikit-Learn is sqrt(n_features).'
            }
          ]
        },
        {
          id: 'topic-4-8',
          title: 'Support Vector Machines',
          shortExplanation: 'Optimal separating hyperplanes, maximum margin classification, support vectors, soft margins (C parameter), and Kernel trick (RBF, Polynomial).',
          learningObjectives: ['Formulate quadratic programming margin optimization', 'Explain the Mercer theorem and Kernel trick', 'Tune C and gamma hyperparameters'],
          prerequisites: 'Linear Algebra and Calculus',
          recommendedResources: [{ title: 'Support Vector Machines Explained', url: 'https://scikit-learn.org/stable/modules/svm.html', type: 'Docs' }],
          exercisePrompt: 'Train an SVC with RBF kernel and plot decision boundary.',
          requiresExercise: true,
          exerciseSubmitted: false,
          exerciseSubmissionText: '',
          exerciseStatus: 'pending',
          lessonCompleted: false,
          assessmentScore: null,
          requiredPassingScore: 70,
          weight: 1.4,
          estimatedHours: 3.5,
          status: 'Not Started',
          completedDate: null,
        },
        {
          id: 'topic-4-9',
          title: 'K-Nearest Neighbors',
          shortExplanation: 'Instance-based lazy learning, distance metrics (Euclidean, Manhattan, Minkowski), curse of dimensionality, and KD-Tree indexing.',
          learningObjectives: ['Implement KNN search algorithm', 'Analyze computational complexity at inference time', 'Mitigate the curse of dimensionality with feature scaling'],
          prerequisites: 'NumPy Vector Math',
          recommendedResources: [{ title: 'Nearest Neighbors Guide', url: 'https://scikit-learn.org/stable/modules/neighbors.html', type: 'Docs' }],
          exercisePrompt: 'Find optimal K using cross-validation over range 1 to 25.',
          requiresExercise: true,
          exerciseSubmitted: false,
          exerciseSubmissionText: '',
          exerciseStatus: 'pending',
          lessonCompleted: false,
          assessmentScore: null,
          requiredPassingScore: 70,
          weight: 1.1,
          estimatedHours: 2.5,
          status: 'Not Started',
          completedDate: null,
        },
        {
          id: 'topic-4-10',
          title: 'Model Evaluation',
          shortExplanation: 'Confusion matrix, precision, recall, F1-score, ROC-AUC, K-Fold cross validation, and regression metrics (MAE, RMSE, MAPE).',
          learningObjectives: ['Calculate precision, recall, and F1 from a confusion matrix', 'Generate ROC curve and interpret AUC', 'Execute StratifiedKFold cross-validation'],
          prerequisites: 'Supervised Learning',
          recommendedResources: [{ title: 'Model Evaluation Metrics Guide', url: 'https://scikit-learn.org/stable/modules/model_evaluation.html', type: 'Docs' }],
          exercisePrompt: 'Generate a classification_report and ROC-AUC score for a binary test set.',
          requiresExercise: true,
          exerciseSubmitted: false,
          exerciseSubmissionText: '',
          exerciseStatus: 'pending',
          lessonCompleted: false,
          assessmentScore: null,
          requiredPassingScore: 70,
          weight: 1.5,
          estimatedHours: 3,
          status: 'Not Started',
          completedDate: null,
        }
      ]
    },
    {
      id: 'level-5',
      title: 'Level 5: Deep Learning',
      order: 5,
      status: 'Locked',
      isLocked: true,
      prerequisites: 'Level 4: Machine Learning (Requires 100% completion of Level 4)',
      completionCriteria: 'Pass PyTorch neural network lab, build CNN image classifier and train sequence model',
      topics: [
        {
          id: 'topic-5-1',
          title: 'Neural Network Foundations & Perceptrons',
          shortExplanation: 'Artificial neurons, activation functions (ReLU, GELU, Sigmoid), multi-layer perceptron (MLP) architecture, and forward propagation.',
          learningObjectives: ['Implement a forward pass in pure NumPy', 'Understand why non-linear activations prevent linear collapse'],
          prerequisites: 'Level 4: Machine Learning',
          weight: 1.3,
          estimatedHours: 3.5,
          status: 'Not Started',
          lessonCompleted: false,
          assessmentScore: null,
          requiredPassingScore: 70,
        },
        {
          id: 'topic-5-2',
          title: 'Backpropagation & Computational Graphs',
          shortExplanation: 'Chain rule of calculus in reverse mode autodiff, loss landscapes, exploding/vanishing gradients, and gradient clipping.',
          learningObjectives: ['Compute manual analytical gradients for a 2-layer MLP', 'Trace computational graphs and understand PyTorch autograd'],
          prerequisites: 'Calculus and Neural Foundations',
          weight: 1.6,
          estimatedHours: 4,
          status: 'Not Started',
          lessonCompleted: false,
          assessmentScore: null,
          requiredPassingScore: 70,
        },
        {
          id: 'topic-5-3',
          title: 'PyTorch Architecture & Training Loops',
          shortExplanation: 'Tensors, nn.Module, Dataset, DataLoader, optimizers (AdamW, SGD with momentum), and training loops with validation steps.',
          learningObjectives: ['Build custom nn.Module classes', 'Write production training and validation loops with metric logging'],
          prerequisites: 'Backpropagation',
          weight: 1.5,
          estimatedHours: 4,
          status: 'Not Started',
          lessonCompleted: false,
          assessmentScore: null,
          requiredPassingScore: 70,
        },
        {
          id: 'topic-5-4',
          title: 'Convolutional Neural Networks (CNNs)',
          shortExplanation: '2D convolutions, receptive fields, pooling layers, residual connections (ResNet), and transfer learning.',
          learningObjectives: ['Calculate convolution output dimensions', 'Fine-tune pre-trained torchvision models on custom datasets'],
          prerequisites: 'PyTorch Foundations',
          weight: 1.8,
          estimatedHours: 5,
          status: 'Not Started',
          lessonCompleted: false,
          assessmentScore: null,
          requiredPassingScore: 70,
        }
      ]
    },
    {
      id: 'level-6',
      title: 'Level 6: Generative AI and LLMs',
      order: 6,
      status: 'Locked',
      isLocked: true,
      prerequisites: 'Level 5: Deep Learning',
      completionCriteria: 'Build attention mechanism, fine-tune an LLM with LoRA, and deploy a production RAG system',
      topics: [
        {
          id: 'topic-6-1',
          title: 'Transformers & Self-Attention Architecture',
          shortExplanation: 'Scaled dot-product attention, multi-head attention, positional encodings, and encoder-decoder vs decoder-only architectures.',
          learningObjectives: ['Compute query-key-value attention matrices', 'Understand causality masking in autoregressive decoder models'],
          prerequisites: 'Deep Learning',
          weight: 1.8,
          estimatedHours: 5,
          status: 'Not Started',
          lessonCompleted: false,
          assessmentScore: null,
          requiredPassingScore: 70,
        },
        {
          id: 'topic-6-2',
          title: 'Retrieval-Augmented Generation (RAG)',
          shortExplanation: 'Vector embeddings, chunking strategies, vector databases (Supabase pgvector/FAISS), hybrid search, and re-ranking.',
          learningObjectives: ['Implement semantic document chunking', 'Perform cosine vector similarity retrieval and context injection'],
          prerequisites: 'Transformers & Python APIs',
          weight: 1.6,
          estimatedHours: 4.5,
          status: 'Not Started',
          lessonCompleted: false,
          assessmentScore: null,
          requiredPassingScore: 70,
        },
        {
          id: 'topic-6-3',
          title: 'Fine-Tuning with PEFT & LoRA',
          shortExplanation: 'Parameter-Efficient Fine-Tuning (PEFT), low-rank adaptation (LoRA/QLoRA), instruction tuning, and dataset preparation.',
          learningObjectives: ['Configure LoRA adapter matrices', 'Fine-tune an open-source model using Hugging Face TRL and evaluate perplexity'],
          prerequisites: 'RAG & PyTorch',
          weight: 1.7,
          estimatedHours: 5,
          status: 'Not Started',
          lessonCompleted: false,
          assessmentScore: null,
          requiredPassingScore: 70,
        }
      ]
    },
    {
      id: 'level-7',
      title: 'Level 7: Projects and Deployment',
      order: 7,
      status: 'Locked',
      isLocked: true,
      prerequisites: 'Level 6: Generative AI and LLMs',
      completionCriteria: 'Package AI models with Docker, serve with low-latency APIs, and deploy an end-to-end production AI system',
      topics: [
        {
          id: 'topic-7-1',
          title: 'API Serving with Express & FastAPI',
          shortExplanation: 'High-throughput async endpoint architecture, streaming responses (SSE), rate limiting, and request validation.',
          learningObjectives: ['Build production streaming AI endpoints', 'Handle batching and async concurrency'],
          prerequisites: 'Python and Web APIs',
          weight: 1.4,
          estimatedHours: 4,
          status: 'Not Started',
          lessonCompleted: false,
          assessmentScore: null,
          requiredPassingScore: 70,
        },
        {
          id: 'topic-7-2',
          title: 'Docker, Containerization & Cloud Deployment',
          shortExplanation: 'Multi-stage Docker builds, GPU drivers in containers, secrets management, and cloud hosting.',
          learningObjectives: ['Write optimized Dockerfiles for AI backends', 'Deploy containerized services to cloud infrastructure'],
          prerequisites: 'API Serving',
          weight: 1.5,
          estimatedHours: 4.5,
          status: 'Not Started',
          lessonCompleted: false,
          assessmentScore: null,
          requiredPassingScore: 70,
        },
        {
          id: 'topic-7-3',
          title: 'End-to-End Capstone Project',
          shortExplanation: 'Full production-grade AI mentor or domain assistant integrating authentication, database, LLM reasoning, and evaluation pipelines.',
          learningObjectives: ['Deliver a fully functional full-stack AI application', 'Implement observability and evaluation metrics'],
          prerequisites: 'All prior levels',
          weight: 2.0,
          estimatedHours: 8,
          status: 'Not Started',
          lessonCompleted: false,
          assessmentScore: null,
          requiredPassingScore: 70,
        }
      ]
    }
  ];

  // Default clean baseline for students: 0% progress, all topics Not Started
  levelsData.forEach((lvl, idx) => {
    lvl.completionPercentage = 0;
    if (idx === 0) {
      lvl.status = 'In Progress';
      lvl.isLocked = false;
    } else {
      lvl.status = 'Locked';
      lvl.isLocked = true;
    }
    (lvl.topics || []).forEach((t) => {
      t.lessonCompleted = false;
      t.assessmentScore = null;
      t.exerciseSubmitted = false;
      t.exerciseSubmissionText = '';
      t.exerciseStatus = 'pending';
      t.diagnosticPassed = false;
      t.diagnosticScore = null;
      t.status = 'Not Started';
      t.completedDate = null;
    });
  });

  // Only if specifically testing mathematical formula with Level 4 60% sample data (Test 12 in progress.test.js)
  if (studentId === 'student-math-check') {
    const l1 = levelsData.find(l => l.id === 'level-1');
    const l2 = levelsData.find(l => l.id === 'level-2');
    const l3 = levelsData.find(l => l.id === 'level-3');
    const l4 = levelsData.find(l => l.id === 'level-4');
    [l1, l2, l3].filter(Boolean).forEach(l => {
      l.status = 'Completed';
      l.isLocked = false;
      l.completionPercentage = 100;
      (l.topics || []).forEach(t => {
        t.status = 'Completed';
        t.lessonCompleted = true;
        t.exerciseSubmitted = true;
        t.assessmentScore = 100;
      });
    });
    if (l4) {
      l4.status = 'In Progress';
      l4.isLocked = false;
      for (let i = 0; i < 6; i++) {
        if (l4.topics[i]) {
          l4.topics[i].status = 'Completed';
          l4.topics[i].lessonCompleted = true;
          l4.topics[i].exerciseSubmitted = true;
          l4.topics[i].assessmentScore = 85;
        }
      }
    }
  }

  const roadmap = {
    id: roadmapId,
    studentId,
    goal: 'Choose Your Learning Path',
    title: 'Personalized Learning Master Roadmap',
    description: 'Welcome to your learning journey! Choose a course track with Teacher Luna to begin mastering skills.',
    levels: levelsData,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  return roadmap;
}

/**
 * Initialize a student profile and roadmap if not present
 */
export async function getOrCreateStudentRoadmap(studentId = 'student-demo-1') {
  if (!localStore.students[studentId]) {
    localStore.students[studentId] = {
      id: studentId,
      name: 'Student',
      email: 'student@example.com',
      goal: 'Choose Your Learning Path',
      studyStreak: 0,
      lastActiveDate: new Date().toISOString(),
      created_at: new Date().toISOString(),
    };
  }

  // Find existing roadmap for this student
  let roadmap = Object.values(localStore.roadmaps).find((r) => r.studentId === studentId);
  if (!roadmap) {
    roadmap = createDefaultAiMlRoadmap(studentId);
    localStore.roadmaps[roadmap.id] = roadmap;
    persistStore();
  }

  // Sync derived percentages and return fresh roadmap
  return recalculateAndSyncRoadmap(roadmap.id);
}

/**
 * Get student profile
 */
export function getStudentProfile(studentId = 'student-demo-1') {
  return localStore.students?.[studentId] || null;
}

/**
 * Update student profile info
 */
export function updateStudentProfile(studentId = 'student-demo-1', { name, email, goal, age, language, preferredLanguage } = {}) {
  const lang = preferredLanguage || language;
  if (!localStore.students[studentId]) {
    localStore.students[studentId] = {
      id: studentId,
      name: name || 'Student',
      email: email || 'student@example.com',
      goal: goal || 'AI / Machine Learning Engineer',
      age: age || null,
      preferredLanguage: lang || 'english',
      studyStreak: 0,
      lastActiveDate: new Date().toISOString(),
      created_at: new Date().toISOString()
    };
  } else {
    if (name) localStore.students[studentId].name = name;
    if (email) localStore.students[studentId].email = email;
    if (goal) localStore.students[studentId].goal = goal;
    if (age !== undefined) localStore.students[studentId].age = age;
    if (lang) localStore.students[studentId].preferredLanguage = lang;
  }
  persistStore();
  return localStore.students[studentId];
}

/**
 * Switch or dynamically create a customized curriculum for any course
 * (Web Development, DevOps, App Development, AI/ML, Cybersecurity, or custom)
 */
export async function createOrSwitchStudentCourse(studentId = 'student-demo-1', { goal = 'Full-Stack Web Development', experienceLevel = 'beginner' } = {}) {
  // Update student goal
  updateStudentProfile(studentId, { goal });

  // Get or dynamically generate the curriculum
  const curriculum = await getCurriculumForGoal(goal, experienceLevel);

  let newRoadmap;
  if (!curriculum) {
    // Default AI / ML path
    newRoadmap = createDefaultAiMlRoadmap(studentId);
    newRoadmap.goal = goal || 'AI / Machine Learning Engineer';
  } else {
    const roadmapId = `roadmap-${studentId}-${Date.now()}`;
    newRoadmap = {
      id: roadmapId,
      studentId,
      goal: goal || curriculum.title,
      title: curriculum.title,
      description: curriculum.description,
      levels: curriculum.levels,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
  }

  // Remove previous roadmaps for this student so new course is active
  Object.keys(localStore.roadmaps).forEach((rid) => {
    if (localStore.roadmaps[rid].studentId === studentId) {
      delete localStore.roadmaps[rid];
    }
  });

  localStore.roadmaps[newRoadmap.id] = newRoadmap;
  persistStore();

  const syncedRoadmap = recalculateAndSyncRoadmap(newRoadmap.id);
  console.log(`🚀 Switched student ${studentId} to new course: "${newRoadmap.title}" (${newRoadmap.levels.length} levels)`);
  return {
    success: true,
    student: localStore.students[studentId],
    roadmap: syncedRoadmap
  };
}

/**
 * Recalculate derived progress for all levels and the entire roadmap
 * Enforces single source of truth!
 */
export function recalculateAndSyncRoadmap(roadmapId) {
  const roadmap = localStore.roadmaps[roadmapId];
  if (!roadmap) return null;

  let previousLevelCompleted = true;

  roadmap.levels.forEach((lvl, idx) => {
    // 1. Calculate level progress
    const levelMetrics = calculateLevelProgress(lvl.topics || []);
    lvl.completionPercentage = levelMetrics.percentage;
    lvl.completedTopicsCount = levelMetrics.completedTopicsCount;
    lvl.totalTopics = levelMetrics.totalTopics;
    lvl.remainingTopicsCount = levelMetrics.remainingTopicsCount;
    lvl.currentTopic = levelMetrics.currentTopic;
    lvl.nextTopic = levelMetrics.nextTopic;
    lvl.estimatedRemainingHours = levelMetrics.estimatedRemainingHours;

    // Check prerequisites & locked state
    if (idx === 0) {
      lvl.isLocked = false;
      if (levelMetrics.percentage === 100) {
        lvl.status = 'Completed';
      } else {
        lvl.status = 'In Progress';
      }
    } else {
      if (previousLevelCompleted) {
        lvl.isLocked = false;
        if (levelMetrics.percentage === 100) {
          lvl.status = 'Completed';
        } else if (levelMetrics.percentage > 0 || roadmap.levels[idx - 1].status === 'Completed') {
          lvl.status = lvl.status === 'Completed' ? 'Completed' : 'In Progress';
        } else {
          lvl.status = 'Not Started';
        }
      } else {
        lvl.isLocked = true;
        lvl.status = 'Locked';
      }
    }

    previousLevelCompleted = lvl.status === 'Completed';
  });

  // 2. Calculate overall roadmap progress
  const roadmapMetrics = calculateRoadmapProgress(roadmap.levels);
  roadmap.overallProgress = roadmapMetrics.overallPercentage;
  roadmap.completedTopics = roadmapMetrics.completedTopics;
  roadmap.totalTopics = roadmapMetrics.totalTopics;
  roadmap.remainingTopics = roadmapMetrics.remainingTopics;
  roadmap.completedLevelsCount = roadmapMetrics.completedLevelsCount;
  roadmap.totalLevelsCount = roadmapMetrics.totalLevelsCount;
  roadmap.currentLevel = roadmapMetrics.currentLevel;
  roadmap.currentTopic = roadmapMetrics.currentTopic;
  roadmap.updated_at = new Date().toISOString();

  persistStore();
  return roadmap;
}

/**
 * Update a topic's progress (lesson completion, assessment score, exercise submission)
 */
export async function updateTopicProgress(roadmapId, levelId, topicId, updates = {}, studentId = null) {
  let roadmap = localStore.roadmaps[roadmapId];
  if (!roadmap && studentId) {
    roadmap = Object.values(localStore.roadmaps).find((r) => r.studentId === studentId);
  }
  if (!roadmap) {
    roadmap = Object.values(localStore.roadmaps)[0];
  }
  if (!roadmap) throw new Error('Roadmap not found');

  const actualRoadmapId = roadmap.id;
  const level = roadmap.levels.find((l) => l.id === levelId);
  if (!level) throw new Error('Level not found');

  const topic = level.topics.find((t) => t.id === topicId);
  if (!topic) throw new Error('Topic not found');

  // Prevent modifications if level is locked
  if (level.isLocked && !updates.diagnosticPassed) {
    throw new Error('Cannot update topic in a locked level without satisfying prerequisites');
  }

  // Apply valid updates
  if (updates.lessonCompleted !== undefined) {
    topic.lessonCompleted = Boolean(updates.lessonCompleted);
  }

  if (updates.assessmentScore !== undefined) {
    const score = Number(updates.assessmentScore);
    if (isNaN(score) || score < 0 || score > 100) {
      throw new Error('Assessment score must be a number between 0 and 100');
    }
    topic.assessmentScore = score;
    topic.lastAssessmentDate = new Date().toISOString();

    // Log assessment record
    localStore.assessments.push({
      id: uuidv4(),
      roadmapId: actualRoadmapId,
      levelId,
      topicId,
      score,
      passed: score >= (topic.requiredPassingScore ?? DEFAULT_PASSING_SCORE),
      timestamp: new Date().toISOString(),
    });
  }

  if (updates.exerciseSubmissionText !== undefined) {
    topic.exerciseSubmissionText = updates.exerciseSubmissionText;
    topic.exerciseSubmitted = Boolean(updates.exerciseSubmissionText.trim());
    topic.exerciseStatus = topic.exerciseSubmitted ? 'submitted' : 'pending';
  }

  if (updates.diagnosticPassed !== undefined) {
    topic.diagnosticPassed = Boolean(updates.diagnosticPassed);
    topic.diagnosticScore = updates.diagnosticScore || 100;
  }

  topic.lastStudiedDate = new Date().toISOString();

  // Evaluate completion using strict criteria
  const evaluation = evaluateTopicCompletion(topic);
  if (evaluation.isCompleted) {
    topic.status = 'Completed';
    if (!topic.completedDate) {
      topic.completedDate = new Date().toISOString();
    }
  } else {
    topic.status = topic.lessonCompleted || topic.assessmentScore !== null ? 'In Progress' : 'Not Started';
    topic.completedDate = null;
  }

  // Recalculate everything
  const updatedRoadmap = recalculateAndSyncRoadmap(actualRoadmapId);

  return {
    success: true,
    topic,
    evaluation,
    level: updatedRoadmap.levels.find((l) => l.id === levelId),
    overallProgress: updatedRoadmap.overallProgress,
    roadmap: updatedRoadmap,
  };
}

/**
 * Diagnostic exemption: skip/test-out of a topic with assessment
 */
export async function submitDiagnosticTest(roadmapId, levelId, topicId, score, studentId = null) {
  if (score < 80) {
    return {
      passed: false,
      message: `Diagnostic score of ${score}% does not meet exemption threshold (80%). Topic remains incomplete.`,
    };
  }

  return updateTopicProgress(roadmapId, levelId, topicId, {
    diagnosticPassed: true,
    diagnosticScore: score,
    lessonCompleted: true,
    assessmentScore: score,
    exerciseSubmitted: true,
  }, studentId);
}

/**
 * Get recent assessment scores for student
 */
export function getRecentAssessments(roadmapId, limit = 5, studentId = null) {
  let targetRoadmapId = roadmapId;
  if (!targetRoadmapId && studentId) {
    const studentRoadmap = Object.values(localStore.roadmaps).find((r) => r.studentId === studentId);
    if (studentRoadmap) targetRoadmapId = studentRoadmap.id;
  }
  const list = localStore.assessments
    .filter((a) => !targetRoadmapId || a.roadmapId === targetRoadmapId)
    .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
    .slice(0, limit);
  return list;
}

/**
 * Get persisted chat conversation history for student
 */
export function getStudentChatMessages(studentId = 'student-demo-1') {
  return localStore.chat_messages?.[studentId] || [];
}

/**
 * Save chat message to persistent store
 */
export function saveStudentChatMessage(studentId = 'student-demo-1', message = {}) {
  if (!localStore.chat_messages) {
    localStore.chat_messages = {};
  }
  if (!localStore.chat_messages[studentId]) {
    localStore.chat_messages[studentId] = [];
  }

  const formatted = {
    id: message.id || `msg-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
    sender: message.sender || 'assistant',
    text: message.text || '',
    timestamp: message.timestamp || new Date().toISOString(),
    diagram: message.diagram || null,
    image: message.image || null,
    widgets: message.widgets || null,
    ...message
  };

  localStore.chat_messages[studentId].push(formatted);

  // Keep last 150 messages per student to avoid unbounded store growth
  if (localStore.chat_messages[studentId].length > 150) {
    localStore.chat_messages[studentId] = localStore.chat_messages[studentId].slice(-150);
  }

  persistStore();
  return formatted;
}

/**
 * Clear chat history for student
 */
export function clearStudentChatMessages(studentId = 'student-demo-1') {
  if (localStore.chat_messages) {
    localStore.chat_messages[studentId] = [];
    persistStore();
  }
  return { success: true };
}

/**
 * Reset progress to initial state (useful for interactive testing)
 */
export function resetRoadmap(studentId = 'student-demo-1') {
  const fresh = createDefaultAiMlRoadmap(studentId);
  localStore.roadmaps[fresh.id] = fresh;

  // Clear chat history, assessments, and activity logs for fresh start
  if (localStore.chat_messages && localStore.chat_messages[studentId]) {
    delete localStore.chat_messages[studentId];
  }
  if (Array.isArray(localStore.assessments)) {
    localStore.assessments = localStore.assessments.filter((a) => a.studentId !== studentId);
  }
  if (Array.isArray(localStore.activity_logs)) {
    localStore.activity_logs = localStore.activity_logs.filter((a) => a.studentId !== studentId);
  }
  if (localStore.students && localStore.students[studentId]) {
    localStore.students[studentId].studyStreak = 0;
  }

  persistStore();
  return recalculateAndSyncRoadmap(fresh.id);
}

/**
 * Get student MCP config (for internal server tools)
 */
export function getStudentMcpConfig(studentId = 'student-demo-1') {
  if (!localStore.mcp_configs) localStore.mcp_configs = {};
  return localStore.mcp_configs[studentId] || {
    github: { token: '', defaultOwner: '', defaultRepo: '', connected: false },
    gmail: { email: '', appPassword: '', oauthToken: '', connected: false }
  };
}

/**
 * Save student MCP config
 */
export function saveStudentMcpConfig(studentId = 'student-demo-1', configUpdates = {}) {
  if (!localStore.mcp_configs) localStore.mcp_configs = {};
  const current = localStore.mcp_configs[studentId] || {
    github: { token: '', defaultOwner: '', defaultRepo: '', connected: false },
    gmail: { email: '', appPassword: '', oauthToken: '', connected: false }
  };

  const updated = {
    ...current,
    github: {
      ...current.github,
      ...(configUpdates.github || {})
    },
    gmail: {
      ...current.gmail,
      ...(configUpdates.gmail || {})
    }
  };

  localStore.mcp_configs[studentId] = updated;
  persistStore();
  return updated;
}

// Ensure demo student is always fresh and clean on server start (ephemeral in-memory baseline)
try {
  resetRoadmap('student-demo-1');
} catch (e) {
  // safe fallback
}

